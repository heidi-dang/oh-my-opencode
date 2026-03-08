export function generateMermaidUrl(mermaidCode: string): string {
  const obj = {
    code: mermaidCode,
    mermaid: '{"theme": "default"}',
    autoSync: true,
    updateDiagram: true
  }
  const json = JSON.stringify(obj)
  const base64 = Buffer.from(json).toString('base64')
  return `https://mermaid.ink/img/${base64}`
}
