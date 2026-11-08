export interface ExcelExportColumn {
  header: string;
  key: string;
  type?: 'string' | 'number';
  numDecimals?: 2 | 4;
}

function escapeXml(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportToExcelSpreadsheet(params: {
  fileName: string;
  sheetName: string;
  columns: ExcelExportColumn[];
  rows: Array<Record<string, unknown>>;
  summaryRow?: Record<string, unknown>;
}): void {
  const { fileName, sheetName, columns, rows, summaryRow } = params;

  const headerCells = columns
    .map(
      (c) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`
    )
    .join('');

  const rowLines = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const rawVal = row[col.key];
          if (rawVal === null || rawVal === undefined) {
            return '<Cell><Data ss:Type="String"></Data></Cell>';
          }
          if (col.type === 'number') {
            const numVal = Number(rawVal);
            if (!Number.isNaN(numVal)) {
              const styleId = col.numDecimals === 4 ? ' ss:StyleID="Number4"' : ' ss:StyleID="Number2"';
              return `<Cell${styleId}><Data ss:Type="Number">${numVal}</Data></Cell>`;
            }
          }
          return `<Cell><Data ss:Type="String">${escapeXml(String(rawVal))}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  let summaryLine = '';
  if (summaryRow) {
    const summaryCells = columns
      .map((col) => {
        const rawVal = summaryRow[col.key];
        if (rawVal === null || rawVal === undefined) {
          return '<Cell ss:StyleID="Total"><Data ss:Type="String"></Data></Cell>';
        }
        if (col.type === 'number') {
          const numVal = Number(rawVal);
          if (!Number.isNaN(numVal)) {
            return `<Cell ss:StyleID="Total"><Data ss:Type="Number">${numVal}</Data></Cell>`;
          }
        }
        return `<Cell ss:StyleID="Total"><Data ss:Type="String">${escapeXml(String(rawVal))}</Data></Cell>`;
      })
      .join('');
    summaryLine = `\n<Row>${summaryCells}</Row>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Total">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="2"/>
   </Borders>
  </Style>
  <Style ss:ID="Number2">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="Number4">
   <NumberFormat ss:Format="#,##0.0000"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   <Row>${headerCells}</Row>
${rowLines}${summaryLine}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${fileName}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
