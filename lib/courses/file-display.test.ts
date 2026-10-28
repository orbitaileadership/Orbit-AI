import { describe, expect, it } from 'vitest';
import { materialStatus, materialType, selectMaterials } from './file-display';

const files = [
  { id: '3', name: 'Lecture 10.pdf', status: 'ready' },
  { id: '1', name: 'Lecture 2.pdf', status: 'ready' },
  { id: '2', name: 'Data.csv', status: 'ready' },
];

describe('material library display', () => {
  it.each([
    ['Slides.PPTX', 'slides'], ['table.xlsm', 'sheets'], ['data.TSV', 'sheets'],
    ['notes.ODT', 'docs'], ['scan.heif', 'images'], ['photo.avif', 'images'],
    ['source.py', 'other'], ['README', 'other'], ['Reading.PDF', 'pdf'],
  ])('classifies %s as %s', (name, type) => expect(materialType({ name })).toBe(type));

  it('uses an explicit image kind even without a filename extension', () => {
    expect(materialType({ name: 'photo', kind: 'image' })).toBe('images');
  });

  it('filters normalized names and types while preserving newest-first input order', () => {
    expect(selectMaterials(files, ' LECTURE ', 'pdf', 'recent').map(f => f.id)).toEqual(['3', '1']);
    expect(selectMaterials(files, '', 'images', 'recent')).toEqual([]);
  });

  it('sorts filenames naturally without mutating the source list', () => {
    expect(selectMaterials(files, '', 'all', 'name').map(f => f.id)).toEqual(['2', '1', '3']);
    expect(files.map(f => f.id)).toEqual(['3', '1', '2']);
  });

  it('uses file type then natural filename for type grouping', () => {
    expect(selectMaterials(files, '', 'all', 'type').map(f => f.id)).toEqual(['1', '3', '2']);
  });

  it('does not call failed, scanned, or unknown-status files ready', () => {
    expect(materialStatus({ ...files[0], status: 'failed' })).toContain('Could not be read');
    expect(materialStatus({ ...files[0], status: 'needs_ocr' })).toContain('limited text');
    expect(materialStatus({ ...files[0], status: 'processing' })).toBe('Indexing · AI can use it when ready');
    expect(materialStatus({ ...files[0], status: 'queued' })).toBe('Indexing · AI can use it when ready');
  });

  it('labels pages, slides, sheets, and image limitations accurately', () => {
    expect(materialStatus({ ...files[0], page_count: 1 })).toBe('1 page · Ready');
    expect(materialStatus({ ...files[0], name: 'slides.pptx', page_count: 4 })).toBe('4 slides · Ready');
    expect(materialStatus({ ...files[2], page_count: 2 })).toBe('2 sheets · Ready');
    expect(materialStatus({ ...files[0], name: 'scan.png' })).toContain('support varies');
  });
});
