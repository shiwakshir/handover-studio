const { ZipArchive } = require('./zipWriter');

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

class DocxBuilder {
  constructor(options = {}) {
    this.title = options.title || 'Standard Operating Procedure';
    this.author = options.author || 'Handover Studio AI';
    this.organization = options.organization || 'Enterprise Operations';
    this.elements = [];
  }

  addTitle(title) {
    this.elements.push({ type: 'title', text: title });
  }

  addHeading1(text) {
    this.elements.push({ type: 'h1', text });
  }

  addHeading2(text) {
    this.elements.push({ type: 'h2', text });
  }

  addHeading3(text) {
    this.elements.push({ type: 'h3', text });
  }

  addParagraph(text, options = {}) {
    this.elements.push({ type: 'p', text, bold: !!options.bold, italic: !!options.italic, color: options.color });
  }

  addCallout(title, text, type = 'info') {
    this.elements.push({ type: 'callout', title, text, calloutType: type });
  }

  addBullet(text, boldPrefix = '') {
    this.elements.push({ type: 'bullet', text, boldPrefix });
  }

  addTable(headers, rows) {
    this.elements.push({ type: 'table', headers, rows });
  }

  addStep(number, title, desc, details = {}) {
    this.elements.push({
      type: 'step',
      number,
      title,
      desc,
      app: details.app,
      timestamp: details.timestamp,
      decision: details.decision,
      validation: details.validation,
      caution: details.caution,
      status: details.status || 'Observed'
    });
  }

  buildDocumentXml() {
    let body = '';

    for (const el of this.elements) {
      if (el.type === 'title') {
        body += `
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Title"/>
            <w:jc w:val="center"/>
            <w:spacing w:before="360" w:after="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="56"/>
              <w:color w:val="1E293B"/>
            </w:rPr>
            <w:t>${escapeXml(el.text)}</w:t>
          </w:r>
        </w:p>`;
      } else if (el.type === 'h1') {
        body += `
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading1"/>
            <w:spacing w:before="400" w:after="160"/>
            <w:pBdr>
              <w:bottom w:val="single" w:sz="12" w:space="4" w:color="3B82F6"/>
            </w:pBdr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="34"/>
              <w:color w:val="1E3A8A"/>
            </w:rPr>
            <w:t>${escapeXml(el.text)}</w:t>
          </w:r>
        </w:p>`;
      } else if (el.type === 'h2') {
        body += `
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading2"/>
            <w:spacing w:before="280" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="28"/>
              <w:color w:val="2563EB"/>
            </w:rPr>
            <w:t>${escapeXml(el.text)}</w:t>
          </w:r>
        </w:p>`;
      } else if (el.type === 'h3') {
        body += `
        <w:p>
          <w:pPr>
            <w:pStyle w:val="Heading3"/>
            <w:spacing w:before="200" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="24"/>
              <w:color w:val="475569"/>
            </w:rPr>
            <w:t>${escapeXml(el.text)}</w:t>
          </w:r>
        </w:p>`;
      } else if (el.type === 'p') {
        body += `
        <w:p>
          <w:pPr>
            <w:spacing w:after="140" w:line="276" w:lineRule="auto"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:sz w:val="22"/>
              <w:color w:val="${el.color || '334155'}"/>
              ${el.bold ? '<w:b/>' : ''}
              ${el.italic ? '<w:i/>' : ''}
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(el.text)}</w:t>
          </w:r>
        </w:p>`;
      } else if (el.type === 'bullet') {
        body += `
        <w:p>
          <w:pPr>
            <w:spacing w:after="80"/>
            <w:ind w:left="400" w:hanging="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/>
              <w:color w:val="2563EB"/>
            </w:rPr>
            <w:t>• </w:t>
          </w:r>
          ${el.boldPrefix ? `<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">${escapeXml(el.boldPrefix)} </w:t></w:r>` : ''}
          <w:r>
            <w:rPr>
              <w:sz w:val="22"/>
              <w:color w:val="334155"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(el.text)}</w:t>
          </w:r>
        </w:p>`;
      } else if (el.type === 'callout') {
        const bg = el.calloutType === 'warning' ? 'FEF3C7' : el.calloutType === 'success' ? 'DCFCE7' : 'EFF6FF';
        const border = el.calloutType === 'warning' ? 'D97706' : el.calloutType === 'success' ? '16A34A' : '3B82F6';
        body += `
        <w:p>
          <w:pPr>
            <w:spacing w:before="160" w:after="160"/>
            <w:pBdr>
              <w:left w:val="single" w:sz="36" w:space="12" w:color="${border}"/>
            </w:pBdr>
            <w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>
            <w:ind w:left="240" w:right="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="22"/>
              <w:color w:val="0F172A"/>
            </w:rPr>
            <w:t>${escapeXml(el.title)}: </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:sz w:val="22"/>
              <w:color w:val="334155"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(el.text)}</w:t>
          </w:r>
        </w:p>`;
      } else if (el.type === 'step') {
        body += `
        <w:p>
          <w:pPr>
            <w:spacing w:before="240" w:after="80"/>
            <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
            <w:pBdr>
              <w:left w:val="single" w:sz="24" w:space="8" w:color="2563EB"/>
            </w:pBdr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:b/>
              <w:sz w:val="26"/>
              <w:color w:val="1E40AF"/>
            </w:rPr>
            <w:t>Step ${el.number}: ${escapeXml(el.title)}</w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:sz w:val="18"/>
              <w:color w:val="64748B"/>
            </w:rPr>
            <w:t xml:space="preserve">  [${escapeXml(el.status)} • ${escapeXml(el.app || 'General')} • @${escapeXml(el.timestamp || '00:00')}]</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:spacing w:after="80"/>
            <w:ind w:left="200"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="22"/>
              <w:color w:val="334155"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(el.desc)}</w:t>
          </w:r>
        </w:p>`;

        if (el.decision) {
          body += `
          <w:p>
            <w:pPr><w:spacing w:after="60"/><w:ind w:left="400"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="D97706"/></w:rPr><w:t>Decision Rule: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="78350F"/></w:rPr><w:t xml:space="preserve">${escapeXml(el.decision)}</w:t></w:r>
          </w:p>`;
        }
        if (el.validation) {
          body += `
          <w:p>
            <w:pPr><w:spacing w:after="60"/><w:ind w:left="400"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="16A34A"/></w:rPr><w:t>Verification Check: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="14532D"/></w:rPr><w:t xml:space="preserve">${escapeXml(el.validation)}</w:t></w:r>
          </w:p>`;
        }
        if (el.caution) {
          body += `
          <w:p>
            <w:pPr><w:spacing w:after="80"/><w:ind w:left="400"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="DC2626"/></w:rPr><w:t>Caution: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="7F1D1D"/></w:rPr><w:t xml:space="preserve">${escapeXml(el.caution)}</w:t></w:r>
          </w:p>`;
        }
      } else if (el.type === 'table') {
        const colCount = el.headers.length;
        const cellWidth = Math.floor(9000 / colCount);

        body += `
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="9000" w:type="dxa"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
              <w:insideV w:val="none"/>
            </w:tblBorders>
          </w:tblPr>
          <w:tr>
            ${el.headers.map(h => `
              <w:tc>
                <w:tcPr>
                  <w:tcW w:w="${cellWidth}" w:type="dxa"/>
                  <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
                </w:tcPr>
                <w:p>
                  <w:pPr><w:spacing w:before="120" w:after="120"/></w:pPr>
                  <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r>
                </w:p>
              </w:tc>
            `).join('')}
          </w:tr>
          ${el.rows.map(row => `
            <w:tr>
              ${row.map(cell => `
                <w:tc>
                  <w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/></w:tcPr>
                  <w:p>
                    <w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>
                    <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(cell)}</w:t></w:r>
                  </w:p>
                </w:tc>
              `).join('')}
            </w:tr>
          `).join('')}
        </w:tbl>
        <w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  toBuffer() {
    const zip = new ZipArchive();

    // [Content_Types].xml
    zip.addFile('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    // _rels/.rels
    zip.addFile('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // word/document.xml
    zip.addFile('word/document.xml', this.buildDocumentXml());

    return zip.toBuffer();
  }
}

module.exports = { DocxBuilder };
