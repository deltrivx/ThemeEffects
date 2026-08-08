# Theme Effects

[简体中文](README.md) | **English** | [Release Index](RELEASES.md)

[![Latest Release](https://img.shields.io/github/v/release/deltrivx/ThemeEffects?display_name=tag&sort=semver&label=latest)](https://github.com/deltrivx/ThemeEffects/releases/latest)
[![Unraid](https://img.shields.io/badge/Unraid-6.12%2B-F15A2C?logo=unraid&logoColor=white)](https://unraid.net/)
[![License](https://img.shields.io/badge/license-GPL--2.0-blue)](LICENSE)
[![Assets](https://img.shields.io/badge/assets-CC%20BY--NC--SA%204.0-8a2be2)](LICENSE-ASSETS.md)

Theme Effects is an independent Unraid WebGUI visual enhancement plugin. It brings themes, wallpapers, particles, mouse effects, cursors, mascots, typography, color controls, responsive layouts, and Community Applications enhancements into the native Unraid interface.

> Current release: **v2.8.9** · Plugin ID: `theme.effects` · Minimum Unraid version: **6.12.0**

## Features

- Global themes, wallpapers, blur levels, and responsive WebGUI layouts.
- Particle effects, glow, rings, trails, sparks, and custom cursor styles.
- Built-in or custom GIF mascots with position, size, opacity, and blur controls.
- Font, font-size, color, local font, and scrollbar customization.
- Community Applications page enhancements for navigation, search, and mobile layouts.
- Browser and Unraid local-path uploads for wallpapers, fonts, GIFs, and cursors.
- Performance profiles that reduce visual workload on lower-powered systems.
- Release archives with SHA256 verification, differential OTA updates, rollback, and flash recovery.

Theme Music is maintained as a separate project and is not included in Theme Effects.

## Installation

In the Unraid WebGUI, open **Plugins -> Install Plugin** and paste:

```text
https://raw.githubusercontent.com/deltrivx/ThemeEffects/main/theme.effects.plg
```

After installation, open **Settings -> User Preferences -> Theme Effects** and enable the master switch.

## Configuration

Theme Effects stores its plugin state and user configuration on the Unraid flash device:

```text
/boot/config/plugins/theme.effects/
```

The runtime is installed at:

```text
/usr/local/emhttp/plugins/theme.effects/
```

Users can configure themes, wallpapers, particles, mouse effects, mascots, fonts, colors, scrollbars, performance profiles, and application-page enhancements from the plugin settings page.

## Compatibility and boundaries

- Supports Unraid 6.12 and later.
- Does not modify Docker containers, virtual machines, array data, or user media files.
- Uploaded user resources and configuration are preserved during upgrades.
- Community Applications DOM changes may affect optional Apps-page enhancements; core themes and effects remain independent.

## Documentation and support

- [Project overview](ABOUT.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Troubleshooting and support](SUPPORT.md)

## License

Program source code is licensed under the [GNU GPL-2.0](LICENSE). Original documentation and visual assets are licensed separately under [CC BY-NC-SA 4.0](LICENSE-ASSETS.md). Third-party names, trademarks, icons, and media remain subject to their respective rights; see [NOTICE](NOTICE).
