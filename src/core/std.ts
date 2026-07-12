// QuickJS `std` module subset used by AthenaEnv games:
//   std.loadFile(path) -> string | null
//   std.open(path, 'w') -> { puts(s), close() }
// Writes are buffered and handed to the host on close().

import type { PS2Host } from './host.ts'

export interface PS2Std {
  loadFile(path: string): string | null
  open(path: string, mode: string): PS2File
}

export interface PS2File {
  puts(data: string): void
  close(): void
}

export function makeStd(host: PS2Host): PS2Std {
  return {
    loadFile(path: string) {
      return host.loadFile(path)
    },
    open(path: string, mode: string): PS2File {
      if (!/w/.test(mode)) {
        throw new Error(`5velte-ps2 std.open: only write modes are shimmed (got "${mode}")`)
      }
      let buffer = ''
      return {
        puts(data: string) {
          buffer += data
        },
        close() {
          host.writeFile(path, buffer)
        },
      }
    },
  }
}
