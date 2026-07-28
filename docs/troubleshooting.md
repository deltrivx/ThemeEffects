# Troubleshooting

## The style does not load

Check that the Theme Effects plugin is installed and enabled:

```bash
cat /boot/config/plugins/theme.effects/theme.effects.cfg
```

Expected:

```text
SERVICE="enabled"
```

Then verify that the runtime files exist:

```bash
ls -la /usr/local/emhttp/plugins/theme.effects/
ls -la /usr/local/emhttp/plugins/theme.effects/assets/
```

## Background image is missing

Verify both copies of the image:

```bash
ls -lh /boot/config/plugins/theme.effects/assets/background.jpg
ls -lh /usr/local/emhttp/plugins/theme.effects/assets/background.jpg
```

## Text is hard to read

Open **Settings -> Display Settings** and set the main text colors to white or near-white. See `docs/display-settings.md`.

## Browser still shows the old style

Refresh the WebGUI with cache bypass:

```text
Windows/Linux: Ctrl + F5
macOS: Command + Shift + R
```

If the old style still appears, disable and re-enable Theme Effects, then refresh again.
