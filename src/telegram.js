const TG = 'https://api.telegram.org';

export async function tgUpload(env, buffer, filename, mime) {
  const form = new FormData();
  form.append('chat_id', env.telegram_chat_id);
  form.append('document', new Blob([buffer], { type: mime }), filename);

  const resp = await fetch(`${TG}/bot${env.telegram_bot_token}/sendDocument`, { method: 'POST', body: form });
  const data = await resp.json();
  if (!data.ok) throw new Error(`Telegram upload failed: ${data.description}`);

  const doc = data.result.document;
  return { fileId: doc.file_id, size: doc.file_size || buffer.byteLength };
}

export async function tgDownloadURL(env, fileId) {
  const resp = await fetch(`${TG}/bot${env.telegram_bot_token}/getFile?file_id=${fileId}`);
  const data = await resp.json();
  if (!data.ok) throw new Error(`Telegram getFile failed: ${data.description}`);
  return `${TG}/file/bot${env.telegram_bot_token}/${data.result.file_path}`;
}
