export function fileErrorPage(status: 403 | 404, message: string): Response {
  const title = status === 404 ? "ファイルが見つかりません" : "アクセスできません";
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
    .box{text-align:center;padding:2rem}
    h1{font-size:3rem;font-weight:bold;color:#9ca3af;margin:0 0 .5rem}
    p{color:#6b7280;margin:.25rem 0}
    a{color:#3b82f6;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="box">
    <h1>${status}</h1>
    <p>${message}</p>
    <p style="margin-top:1rem"><a href="javascript:history.back()">← 戻る</a></p>
  </div>
</body>
</html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
