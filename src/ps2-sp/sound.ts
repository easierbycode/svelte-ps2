// Silent SoundPlayer: the default audio backend accepts every call and
// does nothing. Hosts inject a real player via GameOptions.sound.

import type { SoundPlayer } from './types.ts'

export function createNullSound(): SoundPlayer {
  return {
    init(): void {},
    loadSfx(_key: string, _path: string): void {},
    loadStream(_key: string, _path: string): void {},
    playSfx(_key: string, _volume?: number): void {},
    playSound(_key: string, _volume?: number): void {},
    playBgm(_key: string, _volume?: number): void {},
    stopBgm(): void {},
    stopAllSounds(): void {},
  }
}
