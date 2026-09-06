# 제출 서류 생성

`docs/submit/`의 hwpx·PDF는 공모전 양식(첨부1·첨부2 hwpx)의 파란 안내 문단을 아래 스크립트로 우리 내용으로 바꿔 만든다.

양식 원본은 `tools/submit/templates/`에 있다.

```bash
# spec_*.py의 'team', 'members', 'content'를 고친 뒤 실행.
python tools/submit/fill_hwpx.py tools/submit/templates/plan.hwpx "docs/submit/2026 금융 AI Challenge 기획서_따이호.hwpx" tools/submit/spec_plan.py
python tools/submit/fill_hwpx.py tools/submit/templates/spec.hwpx "docs/submit/2026 금융 AI Challenge 기능명세서_따이호.hwpx" tools/submit/spec_spec.py
```

PDF는 한글(Hancom Office) COM으로 변환한다. PowerShell:

```powershell
$hwp = New-Object -ComObject HWPFrame.HwpObject
$hwp.RegisterModule("FilePathCheckDLL","FilePathCheckerModule") | Out-Null
$hwp.Open("<hwpx 절대경로>","HWPX","forceopen:true")
$hwp.SaveAs("<pdf 절대경로>","PDF","")
$hwp.Quit()
```
