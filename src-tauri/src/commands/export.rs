use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const MAX_PROGRAM_LENGTH: usize = 1024;
const MAX_ARGUMENTS: usize = 64;
const MAX_ARGUMENT_LENGTH: usize = 8192;
const COMMAND_TIMEOUT: Duration = Duration::from_secs(60);

fn validate_request(
    program: &str,
    args: &[String],
    working_directory: Option<&str>,
) -> Result<(), String> {
    if program.trim().is_empty() {
        return Err("Custom export command is empty.".to_string());
    }
    if program.len() > MAX_PROGRAM_LENGTH || program.contains('\0') {
        return Err("Custom export command is too long or invalid.".to_string());
    }
    if args.len() > MAX_ARGUMENTS {
        return Err(format!(
            "Custom export command has more than {MAX_ARGUMENTS} arguments."
        ));
    }
    if args
        .iter()
        .any(|argument| argument.len() > MAX_ARGUMENT_LENGTH || argument.contains('\0'))
    {
        return Err("A custom export argument is too long or invalid.".to_string());
    }
    if let Some(directory) = working_directory.filter(|value| !value.trim().is_empty()) {
        if !Path::new(directory).is_dir() {
            return Err(format!(
                "Custom export working directory does not exist: {directory}"
            ));
        }
    }
    Ok(())
}

fn run_command(
    program: &str,
    args: &[String],
    working_directory: Option<&str>,
) -> Result<i32, String> {
    validate_request(program, args, working_directory)?;

    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(directory) = working_directory.filter(|value| !value.trim().is_empty()) {
        command.current_dir(directory);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Cannot start custom export command: {error}"))?;
    let started = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status.code().unwrap_or(-1)),
            Ok(None) => {
                if started.elapsed() >= COMMAND_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("Custom export command timed out after 60 seconds.".to_string());
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Cannot wait for custom export command: {error}"));
            }
        }
    }
}

/// Runs a user-configured executable without a shell. Arguments are passed as
/// a vector, so document titles and paths cannot be re-tokenized as commands.
#[tauri::command]
pub async fn run_export_command(
    program: String,
    args: Vec<String>,
    working_directory: Option<String>,
) -> Result<i32, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_command(&program, &args, working_directory.as_deref())
    })
    .await
    .map_err(|error| format!("Custom export command task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    fn exit_command(code: &str) -> (String, Vec<String>) {
        (
            "cmd".to_string(),
            vec!["/C".to_string(), "exit".to_string(), code.to_string()],
        )
    }

    #[cfg(not(windows))]
    fn exit_command(code: &str) -> (String, Vec<String>) {
        (
            "sh".to_string(),
            vec!["-c".to_string(), format!("exit {code}")],
        )
    }

    #[test]
    fn rejects_invalid_programs_and_arguments() {
        assert!(validate_request("", &[], None).is_err());
        assert!(validate_request("   ", &[], None).is_err());
        assert!(validate_request("program\0", &[], None).is_err());
        assert!(validate_request(&"p".repeat(MAX_PROGRAM_LENGTH + 1), &[], None).is_err());
        assert!(validate_request("program", &["a\0".to_string()], None).is_err());
        assert!(
            validate_request("program", &vec!["a".to_string(); MAX_ARGUMENTS + 1], None).is_err()
        );
        assert!(validate_request("program", &["a".repeat(MAX_ARGUMENT_LENGTH + 1)], None).is_err());
        assert!(validate_request("program", &[], Some("not-a-real-directory")).is_err());
    }

    #[test]
    fn runs_a_command_with_arguments() {
        let (program, args) = exit_command("0");
        assert_eq!(run_command(&program, &args, None).expect("exit 0"), 0);
    }

    #[test]
    fn reports_a_non_zero_exit_code() {
        let (program, args) = exit_command("7");
        assert_eq!(run_command(&program, &args, None).expect("exit 7"), 7);
    }

    #[test]
    fn reports_a_missing_executable() {
        let error = run_command("marksi-command-that-does-not-exist-12345", &[], None)
            .expect_err("missing executable should fail");
        assert!(error.contains("Cannot start"));
    }

    #[test]
    fn runs_in_the_requested_working_directory() {
        let directory = tempfile::tempdir().expect("tempdir");

        #[cfg(windows)]
        let (program, args) = (
            "cmd".to_string(),
            vec!["/C".to_string(), "echo ok>marker.txt".to_string()],
        );
        #[cfg(not(windows))]
        let (program, args) = (
            "sh".to_string(),
            vec!["-c".to_string(), "printf ok > marker.txt".to_string()],
        );

        let status = run_command(
            &program,
            &args,
            Some(directory.path().to_string_lossy().as_ref()),
        )
        .expect("run in directory");
        assert_eq!(status, 0);
        assert!(directory.path().join("marker.txt").is_file());
    }
}
