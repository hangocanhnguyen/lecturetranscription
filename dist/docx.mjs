const contentTypes = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const relationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

function paragraphXml(text) {
  const escaped = text.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const lines = escaped.split(/\r\n|[\r\n]/).map(line => '<w:t xml:space="preserve">' + line + '</w:t>');
  return '<w:p><w:r>' + lines.join('<w:br/>') + '</w:r></w:p>';
}

export function createDocx(paragraphs) {
  const documentXml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    paragraphs.map(paragraphXml).join('') + '</w:body></w:document>';
  const { zipSync, strToU8 } = globalThis.fflate;
  const bytes = zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(relationships),
    'word/document.xml': strToU8(documentXml)
  });
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
