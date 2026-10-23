use std::fs;
use std::path::{Component, Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;

use super::document::write_atomic;

const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;
const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageAsset {
    path: String,
    relative_path: String,
    name: String,
    size: u64,
}

#[tauri::command]
pub fn import_image_asset(
    document_path: String,
    source_path: String,
    folder: String,
) -> Result<ImageAsset, String> {
    let document = canonical_file(&document_path, "document")?;
    let source = canonical_file(&source_path, "image")?;
    validate_image(&source)?;
    let target_dir = asset_directory(&document, &folder)?;

    // Reinserting an image that already lives in the asset folder should keep
    // its existing path instead of creating a duplicate copy.
    if source.starts_with(&target_dir) {
        return asset_for(&document, &source);
    }

    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Cannot create {}: {error}", target_dir.display()))?;
    let target = unique_target(&target_dir, &source)?;
    let bytes =
        fs::read(&source).map_err(|error| format!("Cannot read {}: {error}", source.display()))?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err("The image is larger than the 25 MB import limit.".to_string());
    }
    write_atomic(&target, &bytes)?;
    asset_for(&document, &target)
}

#[tauri::command]
pub fn save_image_data(
    document_path: String,
    file_name: String,
    folder: String,
    data_base64: String,
) -> Result<ImageAsset, String> {
    let document = canonical_file(&document_path, "document")?;
    let target_dir = asset_directory(&document, &folder)?;
    let data = STANDARD
        .decode(data_base64.trim())
        .map_err(|error| format!("Cannot decode pasted image: {error}"))?;
    if data.len() as u64 > MAX_IMAGE_BYTES {
        return Err("The pasted image is larger than the 25 MB import limit.".to_string());
    }

    let name = normalized_name(&file_name)?;
    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Cannot create {}: {error}", target_dir.display()))?;
    let target = unique_named_target(&target_dir, &name);
    write_atomic(&target, &data)?;
    asset_for(&document, &target)
}

#[tauri::command]
pub fn read_image_data_url(path: String) -> Result<String, String> {
    let image = canonical_file(&path, "image")?;
    validate_image(&image)?;
    let bytes =
        fs::read(&image).map_err(|error| format!("Cannot read {}: {error}", image.display()))?;
    let mime = mime_for(&image)?;
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

fn canonical_file(path: &str, label: &str) -> Result<PathBuf, String> {
    let requested = PathBuf::from(path);
    let target = dunce::canonicalize(&requested)
        .map_err(|error| format!("Cannot open {label} {}: {error}", requested.display()))?;
    if !target.is_file() {
        return Err(format!("{} is not a file", target.display()));
    }
    Ok(target)
}

fn validate_image(path: &Path) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| format!("{} has no file extension", path.display()))?;
    if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!(
            "{} is not a supported image type. Use PNG, JPEG, GIF, WebP, BMP, SVG, AVIF, or ICO.",
            path.display()
        ));
    }
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Cannot inspect {}: {error}", path.display()))?;
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err("The image is larger than the 25 MB limit.".to_string());
    }
    Ok(())
}

fn asset_directory(document: &Path, folder: &str) -> Result<PathBuf, String> {
    let folder = folder.trim();
    let folder = if folder.is_empty() { "assets" } else { folder };
    let relative = Path::new(folder);
    if relative.is_absolute() {
        return Err("The image asset folder must be relative to the document.".to_string());
    }
    for component in relative.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(
                "The image asset folder cannot contain '..' or a drive prefix.".to_string(),
            );
        }
    }
    let parent = document
        .parent()
        .ok_or_else(|| format!("{} has no parent folder", document.display()))?;
    Ok(parent.join(relative))
}

fn unique_target(directory: &Path, source: &Path) -> Result<PathBuf, String> {
    let name = normalized_name(
        source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("image.png"),
    )?;
    Ok(unique_named_target(directory, &name))
}

fn unique_named_target(directory: &Path, name: &str) -> PathBuf {
    let path = Path::new(name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png");

    for index in 0..10_000 {
        let candidate = if index == 0 {
            format!("{stem}.{extension}")
        } else {
            format!("{stem}-{index}.{extension}")
        };
        let target = directory.join(candidate);
        if !target.exists() {
            return target;
        }
    }

    directory.join(format!("{stem}-{}.{}", std::process::id(), extension))
}

fn normalized_name(file_name: &str) -> Result<String, String> {
    let path = Path::new(file_name);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "The image file name has no extension.".to_string())?;
    if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Pasted images must use a supported image extension.".to_string());
    }

    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let mut sanitized = String::new();
    for character in stem.chars() {
        if character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
        {
            sanitized.push('-');
        } else {
            sanitized.push(character);
        }
    }
    let sanitized = sanitized
        .trim()
        .trim_matches('.')
        .trim()
        .chars()
        .take(96)
        .collect::<String>();
    let stem = if sanitized.is_empty() {
        "image"
    } else {
        &sanitized
    };
    Ok(format!("{stem}.{extension}"))
}

fn asset_for(document: &Path, path: &Path) -> Result<ImageAsset, String> {
    let parent = document
        .parent()
        .ok_or_else(|| format!("{} has no parent folder", document.display()))?;
    let relative = path.strip_prefix(parent).unwrap_or(path);
    let relative_path = relative.to_string_lossy().replace('\\', "/");
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Cannot inspect {}: {error}", path.display()))?;
    Ok(ImageAsset {
        path: path.to_string_lossy().into_owned(),
        relative_path,
        name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("image")
            .to_string(),
        size: metadata.len(),
    })
}

fn mime_for(path: &Path) -> Result<&'static str, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| format!("{} has no file extension", path.display()))?;
    match extension.as_str() {
        "png" => Ok("image/png"),
        "jpg" | "jpeg" => Ok("image/jpeg"),
        "gif" => Ok("image/gif"),
        "webp" => Ok("image/webp"),
        "bmp" => Ok("image/bmp"),
        "svg" => Ok("image/svg+xml"),
        "avif" => Ok("image/avif"),
        "ico" => Ok("image/x-icon"),
        _ => Err(format!("{} is not a supported image type", path.display())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn document(directory: &Path) -> PathBuf {
        let path = directory.join("note.md");
        fs::write(&path, "# Image test\n").expect("write document");
        path
    }

    fn image(directory: &Path, name: &str) -> PathBuf {
        let path = directory.join(name);
        fs::write(&path, b"fake image bytes").expect("write image");
        path
    }

    #[test]
    fn imports_an_image_into_the_asset_folder() {
        let directory = tempfile::tempdir().expect("tempdir");
        let document = document(directory.path());
        let source = image(directory.path(), "photo.png");

        let asset = import_image_asset(
            document.to_string_lossy().into_owned(),
            source.to_string_lossy().into_owned(),
            "assets".to_string(),
        )
        .expect("import");

        assert_eq!(asset.relative_path, "assets/photo.png");
        assert_eq!(asset.name, "photo.png");
        assert!(directory.path().join("assets/photo.png").is_file());
    }

    #[test]
    fn avoids_asset_name_collisions() {
        let directory = tempfile::tempdir().expect("tempdir");
        let document = document(directory.path());
        let source = image(directory.path(), "photo.png");
        let document_path = document.to_string_lossy().into_owned();
        let source_path = source.to_string_lossy().into_owned();

        let first = import_image_asset(
            document_path.clone(),
            source_path.clone(),
            "assets".to_string(),
        )
        .expect("first import");
        let second =
            import_image_asset(document_path, source_path, "assets".to_string()).expect("second");

        assert_eq!(first.relative_path, "assets/photo.png");
        assert_eq!(second.relative_path, "assets/photo-1.png");
    }

    #[test]
    fn keeps_images_already_inside_the_asset_folder() {
        let directory = tempfile::tempdir().expect("tempdir");
        let document = document(directory.path());
        let assets = directory.path().join("assets");
        fs::create_dir_all(&assets).expect("assets");
        let source = assets.join("inline.png");
        fs::write(&source, b"image").expect("write image");

        let asset = import_image_asset(
            document.to_string_lossy().into_owned(),
            source.to_string_lossy().into_owned(),
            "assets".to_string(),
        )
        .expect("import");

        assert_eq!(asset.relative_path, "assets/inline.png");
        assert!(!assets.join("inline-1.png").exists());
    }

    #[test]
    fn rejects_parent_folder_traversal() {
        let directory = tempfile::tempdir().expect("tempdir");
        let document = document(directory.path());
        let source = image(directory.path(), "photo.png");

        let error = import_image_asset(
            document.to_string_lossy().into_owned(),
            source.to_string_lossy().into_owned(),
            "../outside".to_string(),
        )
        .expect_err("traversal must fail");

        assert!(error.contains("cannot contain"));
    }

    #[test]
    fn saves_pasted_image_data() {
        let directory = tempfile::tempdir().expect("tempdir");
        let document = document(directory.path());

        let asset = save_image_data(
            document.to_string_lossy().into_owned(),
            "pasted.png".to_string(),
            "assets".to_string(),
            STANDARD.encode(b"pasted bytes"),
        )
        .expect("save pasted image");

        assert_eq!(asset.relative_path, "assets/pasted.png");
        assert_eq!(
            fs::read(directory.path().join("assets/pasted.png")).expect("read"),
            b"pasted bytes"
        );
    }

    #[test]
    fn reads_an_image_as_a_data_url() {
        let directory = tempfile::tempdir().expect("tempdir");
        let image = image(directory.path(), "photo.png");

        let data_url = read_image_data_url(image.to_string_lossy().into_owned()).expect("data url");

        assert!(data_url.starts_with("data:image/png;base64,"));
    }
}
