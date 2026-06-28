# Download List Manager

This tool prepares legal, user-provided download URLs for IDM. It does not scrape pages, bypass access controls, or extract protected media streams.

## TXT input

Put one authorized URL per line:

```txt
https://example.com/file-a.mp4
https://example.com/file-b.zip
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\download-list-manager.ps1 `
  -InputPath .\tools\download-list-example.txt `
  -OutputDir C:\Users\aa\Downloads\Video `
  -OutScript C:\Users\aa\Downloads\Video\idm-import.cmd
```

Then double-click `C:\Users\aa\Downloads\Video\idm-import.cmd` to add the tasks to IDM.

## CSV input

CSV supports `url` plus an optional `fileName` column:

```csv
url,fileName
https://example.com/video.mp4,my-video.mp4
https://example.com/archive.zip,my-archive.zip
```

## Useful options

- `-StartQueue`: starts the IDM queue after adding tasks.
- `-IdmPath`: points to `IDMan.exe` if IDM is installed somewhere unusual.
- `-Mode clean`: only validates and deduplicates URLs.
- `-Mode aria2`: writes an aria2 input list instead of an IDM `.cmd` script.

The script also writes:

- `*.clean.csv`: valid, deduplicated URLs.
- `*.skipped.csv`: invalid or duplicate rows and the reason they were skipped.
