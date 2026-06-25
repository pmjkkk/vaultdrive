// ============================================================
//  Telegram Bot API 封装
//  - 文件 ≤ 20 MB：直接 multipart 上传（sendDocument）
//  - 文件 > 20 MB：先上传到 Telegraph 代理再 sendDocument
//    （实际 Telegram Bot API 上传限制 50 MB，此处统一走 sendDocument）
//  - 下载：getFile → file_path → 拼 CDN URL
// ============================================================

const TG_API = 'https://api.telegram.org';

export async function tgUpload(env, buffer, filename, mime) {
  const token  = env.telegram_bot_token;
  const chatId = env.telegram_chat_id;

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', new Blob([buffer], { type: mime }), filename);

  const resp = await fetch(`${TG_API}/bot${token}/sendDocument`, {
    method: 'POST',
    body: form
  });

  const data = await resp.json();
  if (!data.ok) throw new Error(`Telegram upload failed: ${data.description}`);

  const doc    = data.result.document;
  const fileId = doc.file_id;
  const size   = doc.file_size || buffer.byteLength;

  return { fileId, size };
}

export async function tgDownloadURL(env, fileId) {
  const token = env.telegram_bot_token;

  const resp = await fetch(`${TG_API}/bot${token}/getFile?file_id=${fileId}`);
  const data = await resp.json();
  if (!data.ok) throw new Error(`getFile failed: ${data.description}`);

  const filePath = data.result.file_path;
  return `${TG_API}/file/bot${token}/${filePath}`;
}
