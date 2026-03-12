fn main() {
    tauri_build::build();

    #[cfg(target_os = "macos")]
    {
        build_swift_bridge();
    }
}

#[cfg(target_os = "macos")]
fn build_swift_bridge() {
    use std::env;
    use std::path::PathBuf;
    use std::process::Command;

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let swift_src = manifest_dir.join("swift-bridge/DictSpeechBridge.swift");
    let out_dir = manifest_dir.join("swift-bridge/lib");

    std::fs::create_dir_all(&out_dir).expect("Failed to create swift-bridge/lib directory");

    let lib_path = out_dir.join("libdict_speech_bridge.a");

    // Determine target architecture
    let target = env::var("TARGET").unwrap_or_default();
    let arch = if target.starts_with("aarch64") {
        "arm64"
    } else {
        "x86_64"
    };

    // Compile Swift to static library
    let status = Command::new("swiftc")
        .args([
            "-emit-library",
            "-static",
            "-O",
            "-target",
            &format!("{}-apple-macosx14.0", arch),
            "-o",
        ])
        .arg(&lib_path)
        .arg(&swift_src)
        .status()
        .expect("Failed to run swiftc");

    if !status.success() {
        panic!("Swift compilation failed");
    }

    // Link the static library
    println!(
        "cargo:rustc-link-search=native={}",
        out_dir.to_str().unwrap()
    );
    println!("cargo:rustc-link-lib=static=dict_speech_bridge");

    // Link Swift runtime libraries
    let xcode_output = Command::new("xcode-select")
        .arg("--print-path")
        .output()
        .expect("Failed to run xcode-select");
    let xcode_path = String::from_utf8_lossy(&xcode_output.stdout)
        .trim()
        .to_string();

    let swift_lib_dir = format!(
        "{}/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/macosx",
        xcode_path
    );
    println!("cargo:rustc-link-search=native={}", swift_lib_dir);

    let sdk_swift_dir = format!(
        "{}/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift_static/macosx",
        xcode_path
    );
    println!("cargo:rustc-link-search=native={}", sdk_swift_dir);

    // Link required frameworks
    println!("cargo:rustc-link-lib=framework=Speech");
    println!("cargo:rustc-link-lib=framework=AVFoundation");
    println!("cargo:rustc-link-lib=framework=Foundation");
    println!("cargo:rustc-link-lib=framework=AppKit");
    println!("cargo:rustc-link-lib=framework=Carbon");

    // Link Swift standard libraries
    println!("cargo:rustc-link-lib=dylib=swiftCore");
    println!("cargo:rustc-link-lib=dylib=swiftFoundation");

    // Rerun if Swift source changes
    println!("cargo:rerun-if-changed=swift-bridge/DictSpeechBridge.swift");
}
