// Asset loading: texture atlases, the game.json recipe (normalized from
// the web format to the flat texture/projectileData shape the entities
// expect), an optional pre-exported Firebase level merged over the base
// recipe, player defaults into game state, and the sfx/voice/bgm preloads.

import type { GameContext } from './context.ts'
import type {
  BossData,
  EnemyData,
  Recipe,
  ResolvedGameOptions,
} from './types.ts'

// A pre-exported Firebase levels/{name} entry
interface FirebaseLevelData {
  enemylist?: string[][]
  stageKey?: string
  enemyData?: Record<string, EnemyData>
  bossData?: Record<string, BossData>
}

// Normalize recipe: convert web game.json format to PS2 expected format
// Web bosses use anim.idle/anim.attack; PS2 expects flat texture array
// Web bosses use bulletData; PS2 expects projectileData
function normalizeRecipe(recipe: Recipe | null): void {
  if (!recipe || !recipe.bossData) return

  const bossKeys = Object.keys(recipe.bossData)
  for (let i = 0; i < bossKeys.length; i++) {
    const boss = recipe.bossData[bossKeys[i]]

    // Map anim.idle -> texture (for sprite animation)
    if ((!boss.texture || boss.texture.length === 0) && boss.anim) {
      boss.texture = boss.anim.idle || []
      boss.attackTexture = boss.anim.attack || []
    }

    // Map bulletData -> projectileData
    if (!boss.projectileData && boss.bulletData && boss.bulletData.texture) {
      boss.projectileData = {
        texture: boss.bulletData.texture || [],
        speed: boss.bulletData.speed || 2,
        damage: boss.bulletData.damage || 1,
        hp: boss.bulletData.hp || 1,
        name: 'bullet',
      }
    }

    // Ensure projectileData exists (some bosses have no bullets)
    if (!boss.projectileData) {
      boss.projectileData = { texture: [], speed: 2, damage: 1, hp: 1, name: 'bullet' }
    }

    // Ensure speed exists
    if (!boss.speed) boss.speed = 1
  }
  // Normalize enemy data: map bulletData -> projectileData
  if (recipe.enemyData) {
    const enemyKeys = Object.keys(recipe.enemyData)
    for (let j = 0; j < enemyKeys.length; j++) {
      const enemy = recipe.enemyData[enemyKeys[j]]
      if (!enemy.projectileData && enemy.bulletData && enemy.bulletData.texture) {
        enemy.projectileData = {
          texture: enemy.bulletData.texture || [],
          speed: enemy.bulletData.speed || 2,
          damage: enemy.bulletData.damage || 1,
          hp: enemy.bulletData.hp || 1,
          name: 'bullet',
          interval: enemy.bulletData.interval || 120,
        }
      }
    }
  }

  console.log('[Main] Recipe normalized')
}

// Load a pre-exported Firebase level file and merge it into the base recipe.
// The level file is a JSON export of a Firebase levels/{name} entry containing
// at minimum: { enemylist: [...], stageKey?: "stageN", enemyData?: {...} }
function loadFirebaseLevel(ctx: GameContext, recipe: Recipe, levelPath: string): void {
  const levelText = ctx.rt.std.loadFile(levelPath)
  if (!levelText) {
    console.log('[Main] Firebase level file not found: ' + levelPath)
    return
  }

  const data = JSON.parse(levelText) as FirebaseLevelData
  if (!data || !data.enemylist) {
    console.log('[Main] Firebase level missing enemylist, skipping')
    return
  }

  // Merge enemylist into recipe at the appropriate stageKey
  const stageKey = data.stageKey || 'stage0'
  recipe[stageKey] = { enemylist: data.enemylist }
  console.log('[Main] Firebase level merged into ' + stageKey +
    ' (' + data.enemylist.length + ' waves)')

  // Merge enemyData: use Firebase values, textures come from level_atlas
  // Tag each enemy with its atlas source so rendering knows where to look
  if (data.enemyData) {
    const merged = JSON.parse(JSON.stringify(data.enemyData)) as Record<string, EnemyData>

    for (const ek in merged) {
      // Mark that this enemy's textures are in the level atlas
      merged[ek].atlas = 'level_atlas'
      // Tag projectile atlas too
      const projKey: 'projectileData' | 'bulletData' | null = merged[ek].projectileData
        ? 'projectileData'
        : (merged[ek].bulletData ? 'bulletData' : null)
      const proj = projKey ? merged[ek][projKey] : null
      if (proj) {
        proj.atlas = 'level_atlas'
      }
    }

    recipe.enemyData = merged
    console.log('[Main] Firebase enemyData merged (level_atlas)')
  }

  // Merge bossData: use Firebase values, tag textures with level_atlas
  if (data.bossData) {
    const mergedBoss = JSON.parse(JSON.stringify(data.bossData)) as Record<string, BossData>

    for (const bk in mergedBoss) {
      const boss = mergedBoss[bk]
      if (boss && boss.anim) {
        boss.atlas = 'level_atlas'
      }
      const bossProj = boss && boss.bulletData ? boss.bulletData : null
      if (bossProj) {
        bossProj.atlas = 'level_atlas'
      }
    }

    recipe.bossData = mergedBoss
    console.log('[Main] Firebase bossData merged (level_atlas)')
  }

  // Parse stageId from stageKey and set in game state
  let stageId = parseInt(stageKey.replace('stage', ''), 10)
  if (isNaN(stageId) || stageId < 0) stageId = 0
  if (stageId > 4) stageId = 4
  ctx.state.stageId = stageId
}

export function loadAllAssets(ctx: GameContext, options: ResolvedGameOptions): void {
  console.log('[Main] Loading assets...')

  // Load texture atlases
  // The game uses two main atlases: game_ui and game_asset
  ctx.atlas.loadAtlas('game_ui', 'assets/game_ui.png', 'assets/game_ui.json')
  ctx.atlas.loadAtlas('game_asset', 'assets/game_asset.png', 'assets/game_asset.json')

  // Load cyber-liberty player spritesheet (32x32 frames)
  ctx.atlas.loadSpritesheet('cyber-liberty', 'assets/cyber_liberty.png', 32, 32)

  // Load the level's custom enemy atlas (pre-exported from Firebase)
  if (options.level) {
    ctx.atlas.loadAtlas('level_atlas', options.level.atlasPngPath, options.level.atlasJsonPath)
  }

  // Load game recipe (level data)
  const recipeText = ctx.rt.std.loadFile('assets/game.json')
  if (recipeText) {
    ctx.state.recipe = JSON.parse(recipeText) as Recipe
    console.log('[Main] Recipe loaded')
  } else {
    console.log('[Main] WARNING: game.json not found, using fallback')
    ctx.state.recipe = createFallbackRecipe()
  }

  // Normalize recipe: map web format -> PS2 format
  normalizeRecipe(ctx.state.recipe)

  // Load and merge the pre-exported Firebase level
  if (options.level && ctx.state.recipe) {
    loadFirebaseLevel(ctx, ctx.state.recipe, options.level.dataPath)
  }

  // Initialize player data defaults from recipe
  if (ctx.state.recipe && ctx.state.recipe.playerData) {
    const pd = ctx.state.recipe.playerData
    ctx.state.playerMaxHp = pd.maxHp || 100
    ctx.state.playerHp = pd.maxHp || 100
    ctx.state.spDamage = pd.spDamage || 50
    ctx.state.shootMode = pd.defaultShootName || 'normal'
    ctx.state.shootSpeed = pd.defaultShootSpeed || 'speed_normal'
  }

  // Load sound effects (converted to WAV/ADPCM for PS2)
  const sfxList = [
    'se_shoot', 'se_shoot_b', 'se_explosion', 'se_damage', 'se_guard',
    'se_sp', 'se_sp_explosion', 'se_barrier_start', 'se_barrier_end',
    'se_decision', 'se_correct', 'se_cursor', 'se_over',
  ]
  for (let i = 0; i < sfxList.length; i++) {
    ctx.sound.loadSfx(sfxList[i], 'assets/sounds/' + sfxList[i] + '.wav')
  }

  // Load voice clips
  const voiceList = [
    'voice_titlecall', 'voice_fight', 'voice_ko',
    'voice_another_fighter', 'voice_congra', 'voice_gameover',
    'voice_round0', 'voice_round1', 'voice_round2', 'voice_round3',
    'g_damage_voice', 'g_powerup_voice', 'g_sp_voice',
    'g_adbenture_voice0', 'voice_thankyou',
  ]
  for (let i = 0; i < voiceList.length; i++) {
    ctx.sound.loadSfx(voiceList[i], 'assets/sounds/' + voiceList[i] + '.wav')
  }

  // Load voice countdown
  for (let i = 0; i <= 9; i++) {
    ctx.sound.loadSfx('voice_countdown' + String(i), 'assets/sounds/scene_continue/voice_countdown' + String(i) + '.wav')
  }

  // Load continue voices
  for (let i = 0; i < 3; i++) {
    ctx.sound.loadSfx('g_continue_yes_voice' + String(i), 'assets/sounds/scene_continue/g_continue_yes_voice' + String(i) + '.wav')
  }
  for (let i = 0; i < 2; i++) {
    ctx.sound.loadSfx('g_continue_no_voice' + String(i), 'assets/sounds/scene_continue/g_continue_no_voice' + String(i) + '.wav')
  }

  // Load stage voices
  for (let i = 0; i < 5; i++) {
    ctx.sound.loadSfx('g_stage_voice_' + String(i), 'assets/sounds/scene_game/g_stage_voice_' + String(i) + '.wav')
  }

  // Load boss voices
  const bossNames = ['bison', 'barlog', 'sagat', 'vega', 'goki', 'fang']
  for (let i = 0; i < bossNames.length; i++) {
    const bn = bossNames[i]
    ctx.sound.loadSfx('boss_' + bn + '_voice_add', 'assets/sounds/boss_' + bn + '_voice_add.wav')
    ctx.sound.loadSfx('boss_' + bn + '_voice_ko', 'assets/sounds/boss_' + bn + '_voice_ko.wav')
  }

  // Load BGM streams (OGG for PS2)
  const bgmList = [
    'adventure_bgm',
    'boss_bison_bgm', 'boss_barlog_bgm', 'boss_sagat_bgm',
    'boss_vega_bgm', 'boss_goki_bgm', 'boss_fang_bgm',
    'bgm_continue', 'bgm_gameover',
  ]
  for (let i = 0; i < bgmList.length; i++) {
    ctx.sound.loadStream(bgmList[i], 'assets/sounds/' + bgmList[i] + '.ogg')
  }

  console.log('[Main] Asset loading complete')
}

// Minimal recipe for testing without assets
function createFallbackRecipe(): Recipe {
  return {
    playerData: {
      name: 'player',
      texture: [],
      hp: 100,
      maxHp: 100,
      spDamage: 50,
      defaultShootName: 'normal',
      defaultShootSpeed: 'speed_normal',
      shootNormal: { texture: [], interval: 8, damage: 1, hp: 1 },
      shootBig: { texture: [], interval: 12, damage: 3, hp: 3 },
      shoot3way: { texture: [], interval: 10, damage: 1, hp: 1 },
      barrier: { texture: [] },
    },
    enemyData: {
      enemyA: { name: 'soliderA', texture: [], hp: 2, speed: 1, score: 100, spgage: 5, interval: 60 },
      enemyB: { name: 'soliderB', texture: [], hp: 3, speed: 0.8, score: 150, spgage: 8, interval: 45 },
    },
    bossData: {
      boss0: { name: 'bison', texture: [], hp: 80, score: 5000, spgage: 50, speed: 1, projectileData: { texture: [], speed: 2, damage: 1, hp: 1, name: 'bullet' } },
      boss1: { name: 'barlog', texture: [], hp: 100, score: 6000, spgage: 50, speed: 1, projectileData: { texture: [], speed: 2.5, damage: 1, hp: 1, name: 'bullet' } },
      boss2: { name: 'sagat', texture: [], hp: 120, score: 7000, spgage: 50, speed: 1, projectileData: { texture: [], speed: 2, damage: 1, hp: 1, name: 'bullet' } },
      boss3: { name: 'vega', texture: [], hp: 140, score: 8000, spgage: 50, speed: 1, projectileData: { texture: [], speed: 2, damage: 1, hp: 1, name: 'bullet' } },
      boss4: { name: 'fang', texture: [], hp: 160, score: 10000, spgage: 50, speed: 1, projectileData: { texture: [], speed: 2, damage: 1, hp: 1, name: 'bullet' } },
    },
    stage0: { enemylist: [['A0', '00', 'A0', '00', 'A0', '00', 'A0', '00'], ['00', 'A0', '00', 'A0', '00', 'A0', '00', 'A0'], ['A1', '00', 'A2', '00', 'A9', '00', 'A3', '00']] },
    stage1: { enemylist: [['B0', 'A0', 'B0', '00', 'A0', 'B0', 'A0', '00'], ['00', 'A0', '00', 'B0', '00', 'A0', '00', 'B0'], ['A1', '00', 'A2', '00', 'A9', '00', 'A3', '00']] },
    stage2: { enemylist: [['A0', 'B0', 'A0', 'B0', 'A0', 'B0', 'A0', '00'], ['B0', '00', 'B0', '00', 'B0', '00', 'B0', '00'], ['A1', '00', 'A2', '00', 'A9', '00', 'A3', '00']] },
    stage3: { enemylist: [['B0', 'B0', 'A0', 'A0', 'B0', 'B0', 'A0', '00'], ['A0', 'A0', 'B0', 'B0', 'A0', 'A0', 'B0', '00'], ['A1', 'A2', 'A9', '00', 'A3', '00', 'A1', '00']] },
    stage4: { enemylist: [['B0', 'A0', 'B0', 'A0', 'B0', 'A0', 'B0', 'A0'], ['A0', 'B0', 'A0', 'B0', 'A0', 'B0', 'A0', 'B0'], ['A1', 'A2', 'A9', 'A3', 'A1', 'A2', 'A9', 'A3']] },
  }
}
