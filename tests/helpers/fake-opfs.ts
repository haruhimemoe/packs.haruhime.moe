/**
 * @file tests/helpers/fake-opfs.ts
 * @desc In-memory stand-in for the Origin Private File System (Node and jsdom have none). Covers
 *       only what osz-cache uses: nested directories, files, createWritable committed on close.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

type Dir = { dirs: Map<string, Dir>; files: Map<string, Blob> };
type FakeOpfsOptions = { failWrites?: boolean; noCreateWritable?: boolean };

const newDir = (): Dir => ({ dirs: new Map(), files: new Map() });
const notFound = (name: string) => new DOMException(`${name} not found`, "NotFoundError");

const writableFor = (dir: Dir, name: string, options: FakeOpfsOptions) => async () => {
  const parts: BlobPart[] = [];
  return {
    async write(data: Blob) {
      if (options.failWrites) throw new DOMException("quota exceeded", "QuotaExceededError");
      parts.push(data);
    },
    async close() {
      dir.files.set(name, new Blob(parts));
    },
    async abort() {
      parts.length = 0;
    },
  };
};

const fileHandle = (dir: Dir, name: string, options: FakeOpfsOptions) => ({
  kind: "file" as const,
  name,
  async getFile() {
    const blob = dir.files.get(name);
    if (!blob) throw notFound(name);
    return new File([blob], name);
  },
  // Older Safari has OPFS but no createWritable on the main thread.
  createWritable: options.noCreateWritable ? undefined : writableFor(dir, name, options),
});

const dirHandle = (dir: Dir, name: string, options: FakeOpfsOptions) => ({
  kind: "directory" as const,
  name,
  async getDirectoryHandle(child: string, opts: { create?: boolean } = {}) {
    let next = dir.dirs.get(child);
    if (!next) {
      if (!opts.create) throw notFound(child);
      next = newDir();
      dir.dirs.set(child, next);
    }
    return dirHandle(next, child, options);
  },
  async getFileHandle(child: string, opts: { create?: boolean } = {}) {
    if (!dir.files.has(child)) {
      if (!opts.create) throw notFound(child);
      // Like the real OPFS: creating the handle creates an empty file.
      dir.files.set(child, new Blob([]));
    }
    return fileHandle(dir, child, options);
  },
  async removeEntry(child: string) {
    if (!dir.dirs.delete(child) && !dir.files.delete(child)) throw notFound(child);
  },
});

/**
 * @function createFakeOpfs
 * @param options {{ failWrites?: boolean; noCreateWritable?: boolean }} quota full / older Safari
 * @returns {{ root: FileSystemDirectoryHandle; list(dir: string): string[] }}
 */
export const createFakeOpfs = (options: FakeOpfsOptions = {}) => {
  const root = newDir();
  return {
    root: dirHandle(root, "", options) as unknown as FileSystemDirectoryHandle,
    list: (dirName: string) => [...(root.dirs.get(dirName)?.files.keys() ?? [])],
  };
};
