use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::Serialize;

use super::document::{resolve_write_target, write_atomic};

const MAX_PROGRAM_LENGTH: usize = 4096;
const MAX_DIAGNOSTIC_BYTES: usize = 4096;
const MAX_ERROR_CHARS: usize = 2000;
const MAX_OUTPUT_BYTES: u64 = 256 * 1024 * 1024;
const VERSION_TIMEOUT: Duration = Duration::from_secs(10);
const EXPORT_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocExportResult {
    path: String,
    size: u64,
}

struct ProcessOutput {
    code: i32,
    stdout: String,
    stderr: String,
}

fn pandoc_program(program: &str) -> String {
    let trimmed = program.trim();
    if trimmed.is_empty() {
        "pandoc".to_string()
    } else {
        trimmed.to_string()
    }
}

fn writer_for(format: &str) -> Result<(&'static str, &'static str, bool), String> {
    match format {
        "docx" => Ok(("docx", "docx", false)),
        "odt" => Ok(("odt", "odt", false)),
        "epub" => Ok(("epub", "epub", false)),
        "latex" => Ok(("latex", "tex", true)),
        "rtf" => Ok(("rtf", "rtf", true)),
        _ => Err(format!("Unsupported Pandoc export format: {format}")),
    }
}

fn read_limited<R: Read>(mut reader: R, limit: usize) -> Vec<u8> {
    let mut kept = Vec::new();
    let mut chunk = [0_u8; 4096];
    loop {
        match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                if kept.len() < limit {
                    let take = (limit - kept.len()).min(read);
                    kept.extend_from_slice(&chunk[..take]);
                }
            }
            Err(_) => break,
        }
    }
    kept
}

fn run_process(
    program: &str,
    args: &[String],
    working_directory: Option<&Path>,
    timeout: Duration,
) -> Result<ProcessOutput, String> {
    if program.is_empty() || program.len() > MAX_PROGRAM_LENGTH || program.contains('\0') {
        return Err("Pandoc executable path is invalid.".to_string());
    }

    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(directory) = working_directory {
        command.current_dir(directory);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Cannot start Pandoc: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Cannot read Pandoc output.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Cannot read Pandoc errors.".to_string())?;
    let stdout_handle = std::thread::spawn(move || read_limited(stdout, MAX_DIAGNOSTIC_BYTES));
    let stderr_handle = std::thread::spawn(move || read_limited(stderr, MAX_DIAGNOSTIC_BYTES));

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    return Err(format!(
                        "Pandoc timed out after {} seconds.",
                        timeout.as_secs()
                    ));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_handle.join();
                let _ = stderr_handle.join();
                return Err(format!("Cannot wait for Pandoc: {error}"));
            }
        }
    };

    let stdout = String::from_utf8_lossy(&stdout_handle.join().unwrap_or_default())
        .trim()
        .to_string();
    let stderr = String::from_utf8_lossy(&stderr_handle.join().unwrap_or_default())
        .trim()
        .to_string();

    Ok(ProcessOutput {
        code: status.code().unwrap_or(-1),
        stdout,
        stderr,
    })
}

fn error_detail(stderr: &str) -> String {
    if stderr.is_empty() {
        return String::new();
    }
    let detail: String = stderr.chars().take(MAX_ERROR_CHARS).collect();
    format!(" {detail}")
}

fn build_export_args(
    format: &str,
    input: &Path,
    output: &Path,
    resource_directory: &Path,
) -> Result<Vec<String>, String> {
    let (writer, _, standalone) = writer_for(format)?;
    let mut args = vec![
        "--from=markdown+tex_math_dollars+task_lists+strikeout".to_string(),
        format!("--to={writer}"),
        format!("--output={}", output.to_string_lossy()),
        format!("--resource-path={}", resource_directory.to_string_lossy()),
    ];
    if standalone {
        args.push("--standalone".to_string());
    }
    args.push(input.to_string_lossy().into_owned());
    Ok(args)
}

#[tauri::command]
pub async fn pandoc_version(program: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let program = pandoc_program(&program);
        let output = run_process(&program, &["--version".to_string()], None, VERSION_TIMEOUT)?;
        if output.code != 0 {
            return Err(format!(
                "Pandoc exited with code {}.{}",
                output.code,
                error_detail(&output.stderr)
            ));
        }
        let version = output
            .stdout
            .lines()
            .find(|line| line.trim_start().to_lowercase().starts_with("pandoc "))
            .or_else(|| output.stdout.lines().next())
            .unwrap_or("Pandoc")
            .trim()
            .to_string();
        if version.is_empty() {
            return Err("Pandoc did not report a version.".to_string());
        }
        Ok(version)
    })
    .await
    .map_err(|error| format!("Pandoc detection task failed: {error}"))?
}

#[tauri::command]
pub async fn pandoc_export(
    program: String,
    content: String,
    document_path: Option<String>,
    output_path: String,
    format: String,
) -> Result<PandocExportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if content.trim().is_empty() {
            return Err("There is nothing to export yet.".to_string());
        }
        let (_, extension, _) = writer_for(&format)?;
        let target = resolve_write_target(Path::new(&output_path))?;
        let target_extension = target
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if target_extension != extension {
            return Err(format!(
                "Pandoc output must use the .{extension} extension."
            ));
        }

        let document = document_path
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from);
        let resource_directory = document
            .as_ref()
            .and_then(|value| value.parent())
            .filter(|value| value.is_dir())
            .map(Path::to_path_buf);
        let temporary = tempfile::tempdir()
            .map_err(|error| format!("Cannot create a Pandoc workspace: {error}"))?;
        let input = temporary.path().join("input.md");
        fs::write(&input, content.as_bytes())
            .map_err(|error| format!("Cannot write the Pandoc input: {error}"))?;
        let output = temporary.path().join(format!("output.{extension}"));
        let resource = resource_directory
            .as_deref()
            .unwrap_or_else(|| temporary.path());
        let args = build_export_args(&format, &input, &output, resource)?;
        let program = pandoc_program(&program);
        let result = run_process(&program, &args, Some(temporary.path()), EXPORT_TIMEOUT)?;
        if result.code != 0 {
            return Err(format!(
                "Pandoc exited with code {}.{}",
                result.code,
                error_detail(&result.stderr)
            ));
        }

        let metadata = fs::metadata(&output)
            .map_err(|error| format!("Pandoc did not write an output file: {error}"))?;
        if metadata.len() == 0 {
            return Err("Pandoc produced an empty file.".to_string());
        }
        if metadata.len() > MAX_OUTPUT_BYTES {
            return Err("Pandoc output is larger than 256 MB.".to_string());
        }
        let bytes =
            fs::read(&output).map_err(|error| format!("Cannot read Pandoc output: {error}"))?;
        write_atomic(&target, &bytes)?;

        Ok(PandocExportResult {
            path: target.to_string_lossy().into_owned(),
            size: bytes.len() as u64,
        })
    })
    .await
    .map_err(|error| format!("Pandoc export task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    fn echo_command() -> (String, Vec<String>) {
        (
            "cmd".to_string(),
            vec!["/C".to_string(), "echo hello".to_string()],
        )
    }

    #[cfg(not(windows))]
    fn echo_command() -> (String, Vec<String>) {
        (
            "sh".to_string(),
            vec!["-c".to_string(), "printf hello".to_string()],
        )
    }

    #[test]
    fn resolves_the_default_program_and_formats() {
        assert_eq!(pandoc_program(""), "pandoc");
        assert_eq!(
            pandoc_program("  C:\\Pandoc\\pandoc.exe  "),
            "C:\\Pandoc\\pandoc.exe"
        );
        assert_eq!(writer_for("docx").expect("docx").0, "docx");
        assert_eq!(writer_for("latex").expect("latex").1, "tex");
        assert!(writer_for("pdf").is_err());
    }

    #[test]
    fn builds_fixed_export_arguments() {
        let args = build_export_args(
            "docx",
            Path::new("C:\\notes\\input.md"),
            Path::new("C:\\notes\\output.docx"),
            Path::new("C:\\notes"),
        )
        .expect("args");
        assert!(args.contains(&"--to=docx".to_string()));
        assert!(args.contains(&"--output=C:\\notes\\output.docx".to_string()));
        assert!(args.contains(&"--resource-path=C:\\notes".to_string()));
        assert!(!args.contains(&"--standalone".to_string()));
        assert_eq!(args.last().expect("input"), "C:\\notes\\input.md");

        let latex = build_export_args(
            "latex",
            Path::new("input.md"),
            Path::new("output.tex"),
            Path::new("."),
        )
        .expect("latex args");
        assert!(latex.contains(&"--standalone".to_string()));
    }

    #[test]
    fn captures_process_output() {
        let (program, args) = echo_command();
        let output = run_process(&program, &args, None, Duration::from_secs(10)).expect("run");
        assert_eq!(output.code, 0);
        assert!(output.stdout.contains("hello"));
    }

    #[test]
    fn rejects_invalid_programs() {
        assert!(run_process("", &[], None, Duration::from_secs(1)).is_err());
        assert!(run_process("pandoc\0", &[], None, Duration::from_secs(1)).is_err());
    }
}
