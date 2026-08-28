// CAD deliverables (AutoCAD .dwg, 12d Model .12da) warrant a transmittal
// notice when they change — unlike a PDF spec, nobody downstream can tell
// without opening the file that the drawing data underneath has moved.
// Pure string matching, no Node built-ins — safe to import from client code.
const CAD_EXTENSIONS = [".dwg", ".12da"];

export function isCadFile(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return CAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
