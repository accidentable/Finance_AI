# 제출 서류 생성

`docs/submit/`의 hwpx·PDF는 공모전 양식(첨부1·첨부2 hwpx)의 파란 안내 문단을 아래 스크립트로 우리 내용으로 바꿔 만든다.

```bash
# 양식 원본(hwpx)을 두고 실행. spec_*.py의 'team', 'members', 'content'를 고친다.
python tools/submit/fill_hwpx.py "(첨부1) 원본.hwpx" "docs/submit/(첨부1) 2026 금융 AI Challenge 공모전 기획서_따이호.hwpx" tools/submit/spec_plan.py
python tools/submit/fill_hwpx.py "(첨부2) 원본.hwpx" "docs/submit/(첨부2) 2026 금융 AI Challenge 기능명세서_따이호.hwpx" tools/submit/spec_spec.py
```

PDF는 한글(Hancom Office) COM으로 변환한다. PowerShell:

```powershell
$hwp = New-Object -ComObject HWPFrame.HwpObject
$hwp.RegisterModule("FilePathCheckDLL","FilePathCheckerModule") | Out-Null
$hwp.Open("<hwpx 절대경로>","HWPX","forceopen:true")
$hwp.SaveAs("<pdf 절대경로>","PDF","")
$hwp.Quit()
```
