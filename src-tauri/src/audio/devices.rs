use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DeviceType {
    Input,
    Output,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub device_type: DeviceType,
}

fn device_display_name(device: &cpal::Device) -> Option<String> {
    device.description().ok().map(|d| d.name().to_string())
}

fn device_stable_id(device: &cpal::Device) -> Option<String> {
    device.id().ok().map(|id| id.to_string())
}

fn collect_devices(
    devices: impl Iterator<Item = cpal::Device>,
    default_id: Option<String>,
    device_type: DeviceType,
) -> Vec<AudioDevice> {
    devices
        .filter_map(|device| {
            let id = device_stable_id(&device)?;
            let name = device_display_name(&device)?;
            Some(AudioDevice {
                is_default: default_id.as_deref() == Some(&id),
                id,
                name,
                device_type,
            })
        })
        .collect()
}

pub fn list_input_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let default_id = host
        .default_input_device()
        .and_then(|d| device_stable_id(&d));

    let devices = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {e}"))?;

    Ok(collect_devices(devices, default_id, DeviceType::Input))
}

pub fn list_output_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let default_id = host
        .default_output_device()
        .and_then(|d| device_stable_id(&d));

    let devices = host
        .output_devices()
        .map_err(|e| format!("Failed to enumerate output devices: {e}"))?;

    Ok(collect_devices(devices, default_id, DeviceType::Output))
}

pub fn list_all_devices() -> Result<Vec<AudioDevice>, String> {
    let mut all = list_input_devices()?;
    all.extend(list_output_devices()?);
    Ok(all)
}
