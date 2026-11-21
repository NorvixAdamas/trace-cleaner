/** Fixture OOXML tối giản nhưng đúng cấu trúc relationship. */
import { buildZip } from './zip-builder.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const contentTypes = extra => `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${extra}
</Types>`;

const rels = list => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${list.map(item => `<Relationship Id="${item.id}" Type="${item.type}" Target="${item.target}"${item.external ? ' TargetMode="External"' : ''}/>`).join('')}
</Relationships>`;

const coreXml = ({ creator = 'Người viết', lastBy = 'Người sửa', created = '2026-01-01T00:00:00Z', modified = '2026-01-02T00:00:00Z', revision = 7 } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
<dc:creator>${creator}</dc:creator><cp:lastModifiedBy>${lastBy}</cp:lastModifiedBy>
<cp:revision>${revision}</cp:revision>
<dcterms:created>${created}</dcterms:created><dcterms:modified>${modified}</dcterms:modified>
</cp:coreProperties>`;

const appXml = ({ minutes = 42, words = 120, application = 'Microsoft Office Word' } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>${application}</Application><AppVersion>16.0000</AppVersion>
<Company>Trace</Company><TotalTime>${minutes}</TotalTime><Words>${words}</Words>
</Properties>`;

export async function buildDocx(options = {}) {
  const document = options.document || `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>
<w:p w:rsidR="00AB12CD"><w:r><w:t>Câu gốc </w:t></w:r><w:ins w:id="1" w:author="An" w:date="2026-01-03T10:00:00Z"><w:r><w:t>chèn mới</w:t></w:r></w:ins><w:del w:id="2" w:author="Bình" w:date="2026-01-04T11:00:00Z"><w:r><w:delText>bỏ đi</w:delText></w:r></w:del><w:r><w:t> kết thúc</w:t></w:r></w:p>
<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Đoạn có comment</w:t></w:r><w:commentRangeEnd w:id="0"/></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Ô trong bảng</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
</w:body></w:document>`;
  return buildZip([
    { name: '[Content_Types].xml', data: contentTypes('<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>') },
    { name: '_rels/.rels', data: rels([{ id: 'rId1', type: `${R}/officeDocument`, target: 'word/document.xml' }]) },
    { name: 'docProps/core.xml', data: coreXml(options) },
    { name: 'docProps/app.xml', data: appXml(options) },
    { name: 'word/document.xml', data: document },
    { name: 'word/_rels/document.xml.rels', data: rels([{ id: 'rId9', type: `${R}/comments`, target: 'comments.xml' }]) },
    {
      name: 'word/comments.xml',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<w:comments xmlns:w="${W}"><w:comment w:id="0" w:author="Reviewer" w:date="2026-01-05T09:00:00Z" w:initials="RV"><w:p><w:r><w:t>Sửa lại câu này</w:t></w:r></w:p></w:comment>
</w:comments>`,
    },
  ]);
}

export async function buildPptx(options = {}) {
  const presentation = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="${R}">
<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst>
</p:presentation>`;
  const slide1 = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Tiêu đề một</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:nvPr/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Nội dung một</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;
  const slide2 = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Nội dung hai</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  const notes = options.notes || `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>7</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Ghi chú cho slide 1</a:t></a:r></a:p><a:p><a:r><a:t>Dòng hai</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:notes>`;
  return buildZip([
    { name: '[Content_Types].xml', data: contentTypes('') },
    { name: '_rels/.rels', data: rels([{ id: 'rId1', type: `${R}/officeDocument`, target: 'ppt/presentation.xml' }]) },
    { name: 'docProps/app.xml', data: appXml({ application: 'Microsoft Office PowerPoint' }) },
    { name: 'ppt/presentation.xml', data: presentation },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      data: rels([
        { id: 'rId1', type: `${R}/slideMaster`, target: 'slideMasters/slideMaster1.xml' },
        // Cố tình đảo thứ tự file so với thứ tự trong sldIdLst.
        { id: 'rId2', type: `${R}/slide`, target: 'slides/slide2.xml' },
        { id: 'rId3', type: `${R}/slide`, target: 'slides/slide1.xml' },
      ]),
    },
    { name: 'ppt/slides/slide2.xml', data: slide2 },
    { name: 'ppt/slides/slide1.xml', data: slide1 },
    {
      name: 'ppt/slides/_rels/slide2.xml.rels',
      data: rels([{ id: 'rId5', type: `${R}/notesSlide`, target: '../notesSlides/notesSlide1.xml' }]),
    },
    { name: 'ppt/notesSlides/notesSlide1.xml', data: notes },
  ]);
}

export async function buildXlsx(options = {}) {
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}">
<workbookPr date1904="0"/>
<sheets>
<sheet name="Dữ liệu" sheetId="1" r:id="rId1"/>
<sheet name="Ẩn" sheetId="2" state="hidden" r:id="rId2"/>
<sheet name="Trống" sheetId="3" r:id="rId3"/>
</sheets></workbook>`;
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
<si><t>Xin chào</t></si>
<si><r><t>Đậm</t></r><r><t xml:space="preserve"> thường</t></r></si>
</sst>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs>
</styleSheet>`;
  const sheet1 = options.sheet1 || `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="1"><v>45000</v></c><c r="C1" t="inlineStr"><is><t>Chuỗi nội tuyến</t></is></c><c r="D1"><f>SUM(A2:A3)</f><v>5</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>2.5</v></c></row>
<row r="3"><c r="A3" t="b"><v>1</v></c></row>
<row r="4"/>
</sheetData></worksheet>`;
  return buildZip([
    { name: '[Content_Types].xml', data: contentTypes('') },
    { name: '_rels/.rels', data: rels([{ id: 'rId1', type: `${R}/officeDocument`, target: 'xl/workbook.xml' }]) },
    { name: 'xl/workbook.xml', data: workbook },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: rels([
        { id: 'rId1', type: `${R}/worksheet`, target: 'worksheets/sheet1.xml' },
        { id: 'rId2', type: `${R}/worksheet`, target: 'worksheets/sheet2.xml' },
        { id: 'rId3', type: `${R}/worksheet`, target: 'worksheets/sheet3.xml' },
        { id: 'rId4', type: `${R}/sharedStrings`, target: 'sharedStrings.xml' },
        { id: 'rId5', type: `${R}/styles`, target: 'styles.xml' },
      ]),
    },
    { name: 'xl/sharedStrings.xml', data: sharedStrings },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheet1 },
    { name: 'xl/worksheets/sheet2.xml', data: '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>' },
    { name: 'xl/worksheets/sheet3.xml', data: '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>' },
  ]);
}
