/** 把 SSE ReadableStream 解析为逐个 JSON 事件（浏览器与测试共用） */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            yield JSON.parse(line.slice(6));
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
