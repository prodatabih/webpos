import { describe, expect, it, vi } from 'vitest';
import { buildExcelXml, exportToExcel } from './exportExcel';

describe('exportExcel', () => {
  it('generates valid SpreadsheetML XML with headers and rows', () => {
    const headers = ['Šifra', 'Naziv artikla', 'Količina', 'Cijena'];
    const rows = [
      ['10001', 'Zlatna Džezva & Kafa', 10, 8.5],
      ['10002', 'Mlijeko <Meggle> "2.8%"', 25.5, 2.15],
    ];

    const xml = buildExcelXml('Artikli & Cijene', headers, rows);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('urn:schemas-microsoft-com:office:spreadsheet');
    expect(xml).toContain('ss:Name="Artikli &amp; Cijene"');
    expect(xml).toContain('Zlatna Džezva &amp; Kafa');
    expect(xml).toContain('Mlijeko &lt;Meggle&gt; &quot;2.8%&quot;');
    expect(xml).toContain('<Data ss:Type="Number">8.5</Data>');
    expect(xml).toContain('<Data ss:Type="Number">25.5</Data>');
  });

  it('triggers download with correct blob MIME type and filename extension', () => {
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    const mockDocument = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();

    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', {});
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    exportToExcel('artikli_izvjestaj', 'Izvjestaj', ['Kolona 1'], [['Vrijednost 1']]);

    expect(createObjectURLMock).toHaveBeenCalled();
    const calls = createObjectURLMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstCall = calls[0] as [Blob];
    const createdBlob = firstCall[0];
    expect(createdBlob.type).toBe('application/vnd.ms-excel;charset=utf-8');
    expect(mockAnchor.download).toBe('artikli_izvjestaj.xls');
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');

    vi.unstubAllGlobals();
  });
});
