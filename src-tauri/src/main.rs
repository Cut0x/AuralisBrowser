// Cache la fenetre console Windows supplementaire en mode release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    auralis_lib::run()
}
