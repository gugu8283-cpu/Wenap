/**
 * Read POST /analyze SSE response (same wire format as App.jsx).
 * Returns the last viz snapshot and optional meta from the stream.
 */
export async function consumeAnalyzeStream(response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const dec = new TextDecoder()
  let sseBuf = ''
  let vizSnapshot = null
  let meta = null
  let errMsg = ''

  function consumeBlock(block) {
    for (const line of block.split('\n')) {
      const L = line.trim()
      if (!L.startsWith('data:')) continue
      let data
      try {
        data = JSON.parse(L.slice(5).trim())
      } catch {
        continue
      }
      if (data.type === 'meta') meta = data
      if (data.type === 'viz' && data.snapshot) vizSnapshot = data.snapshot
      if (data.type === 'data_warning') {
        errMsg = data.message || 'Limited market data for this ticker.'
      }
      if (data.type === 'error') errMsg = data.message || 'Analysis error'
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    sseBuf += dec.decode(value, { stream: true })
    const blocks = sseBuf.split('\n\n')
    sseBuf = blocks.pop() || ''
    for (const block of blocks) consumeBlock(block)
  }
  if (sseBuf.trim()) consumeBlock(sseBuf)

  if (errMsg) throw new Error(errMsg)
  if (!vizSnapshot) throw new Error('No analysis result in stream')
  return { vizSnapshot, meta }
}
