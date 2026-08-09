const DEFAULT_BASE = 'https://tools.moddable.games'

const DEFAULT_ENGINE_BASE = 'https://engine.moddable.games'

export class ModdableTools {
  constructor(opts = {}) {
    this.base = (opts.base || DEFAULT_BASE).replace(/\/$/, '')
    this.engineBase = (opts.engineBase || DEFAULT_ENGINE_BASE).replace(/\/$/, '')
    this.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }

    this.chess = new ChessNamespace(this)
    this.hex = new HexNamespace(this)
    this.play = new PlayNamespace(this)
    this.rules = new RulesNamespace(this)
    this.gallery = new GalleryNamespace(this)
    this.oracles = new OraclesNamespace(this)
    this.games = new GamesNamespace(this)
    this.utilities = new UtilitiesNamespace(this)
    this.render = new RenderHelpers(this)
    this.embed = new EmbedHelpers(this)
  }

  async call(tool, args = {}) {
    const resp = await fetch(`${this.base}/api/call`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ tool, args }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      throw new ToolError(tool, err.error || resp.statusText, resp.status)
    }
    return resp.json()
  }

  async tools() {
    const resp = await fetch(`${this.base}/api/tools`, { headers: this.headers })
    return resp.json()
  }

  async help(tool) {
    const resp = await fetch(`${this.base}/help/${tool}`, { headers: this.headers })
    return resp.json()
  }
}

export class ToolError extends Error {
  constructor(tool, message, status) {
    super(`${tool}: ${message}`)
    this.tool = tool
    this.status = status
  }
}

class Namespace {
  constructor(client) { this.client = client }
  call(tool, args) { return this.client.call(tool, args) }
}

class ChessNamespace extends Namespace {
  listVariants() { return this.call('chess_list_variants') }
  getLegalMoves(args) { return this.call('chess_get_legal_moves', args) }
  analyzePosition(args) { return this.call('chess_analyze_position', args) }
  makeMove(args) { return this.call('chess_make_move', args) }
  makeMoves(args) { return this.call('chess_make_moves', args) }
  validateMove(args) { return this.call('chess_validate_move', args) }
  getStatus(args) { return this.call('chess_get_status', args) }
  generatePuzzle(args = {}) { return this.call('chess_generate_puzzle', args) }
  renderSvg(args) { return this.call('chess_render_svg', args) }
  getOpeningBook(args = {}) { return this.call('chess_get_opening_book', args) }
  listPuzzleTypes() { return this.call('chess_list_puzzle_types') }
}

class HexNamespace extends Namespace {
  listGames() { return this.call('hex_list_games') }
  generateMap(args) { return this.call('hex_generate_map', args) }
  exportSvg(args) { return this.call('hex_export_svg', args) }
  getInfo(args) { return this.call('hex_get_info', args) }
  computeFov(args) { return this.call('hex_compute_fov', args) }
  pathfind(args) { return this.call('hex_pathfind', args) }
}

class PlayNamespace extends Namespace {
  listFamilies() { return this.call('play_list_families') }
  createGame(args) { return this.call('play_create_game', args) }
  getMoves(args) { return this.call('play_get_moves', args) }
  applyMove(args) { return this.call('play_apply_move', args) }
  checkStatus(args) { return this.call('play_check_status', args) }
  suggestMove(args) { return this.call('play_suggest_move', args) }
  renderBoard(args) { return this.call('play_render_board', args) }
}

class RulesNamespace extends Namespace {
  listGames() { return this.call('rules_list_games') }
  getGame(args) { return this.call('rules_get_game', args) }
  getVariant(args) { return this.call('rules_get_variant', args) }
  search(args) { return this.call('rules_search', args) }
  random() { return this.call('rules_random') }
}

class GalleryNamespace extends Namespace {
  searchBoards(args = {}) { return this.call('board_gallery_search', args) }
  getBoard(args) { return this.call('board_gallery_get', args) }
  boardStats() { return this.call('board_gallery_stats') }
  searchTiles(args = {}) { return this.call('tile_gallery_search', args) }
  getTile(args) { return this.call('tile_gallery_get', args) }
  tileStats() { return this.call('tile_gallery_stats') }
  searchPieces(args = {}) { return this.call('piece_gallery_search', args) }
  getPieceSet(args) { return this.call('piece_gallery_get_set', args) }
  pieceStats() { return this.call('piece_gallery_stats') }
}

class OraclesNamespace extends Namespace {
  listGames() { return this.call('oracle_list_games') }
  roll(args) { return this.call('oracle_roll', args) }
  listTables(args) { return this.call('oracle_list_tables', args) }
  ask(args) { return this.call('oracle_ask', args) }
  scene(args = {}) { return this.call('oracle_scene', args) }
  listRecipes(args = {}) { return this.call('oracle_list_recipes', args) }
  interpret(args) { return this.call('oracle_interpret', args) }
  tableView(args) { return this.call('oracle_table_view', args) }
  encounter(args = {}) { return this.call('oracle_encounter', args) }
  chargen(args) { return this.call('rpg_chargen', args) }
  searchEntities(args) { return this.call('rpg_search_entities', args) }
  getEntity(args) { return this.call('rpg_get_entity', args) }
  randomEncounter(args = {}) { return this.call('rpg_random_encounter', args) }
  browseCategory(args) { return this.call('rpg_browse_category', args) }
  listCategories(args = {}) { return this.call('rpg_list_categories', args) }
  loot(args = {}) { return this.call('rpg_loot', args) }
  random(args) { return this.call('rpg_random', args) }
}

class GamesNamespace extends Namespace {
  ti4RandomFactions(args) { return this.call('ti4_random_factions', args) }
  ti4DraftFactions(args = {}) { return this.call('ti4_draft_factions', args) }
  ti4DrawObjectives(args = {}) { return this.call('ti4_draw_objectives', args) }
  ti4DrawAgendas(args = {}) { return this.call('ti4_draw_agendas', args) }
  nukesSetup(args = {}) { return this.call('nukes_setup_generator', args) }
  nukesCombat(args) { return this.call('game_nukes_combat', args) }
  talismanDrawCharacters(args = {}) { return this.call('talisman_draw_characters', args) }
  talismanDrawEncounter(args = {}) { return this.call('talisman_draw_encounter', args) }
  colonyDiceOdds(args) { return this.call('colony_dice_odds', args) }
  deckCreate(args = {}) { return this.call('game_deck_create', args) }
  scoreTracker(args) { return this.call('game_score_tracker', args) }
  jamStatus() { return this.call('jam_status') }
  jamTimer() { return this.call('jam_timer') }
  jamVote() { return this.call('jam_vote') }
}

class UtilitiesNamespace extends Namespace {
  diceRoll(args) { return this.call('dice_roll', args) }
  coinFlip(args = {}) { return this.call('coin_flip', args) }
  teamSplit(args) { return this.call('team_split', args) }
  randomPlayerOrder(args) { return this.call('random_player_order', args) }
  timerSuggest(args) { return this.call('timer_suggest', args) }
  gameJamTheme(args = {}) { return this.call('game_jam_theme', args) }
  diceOdds(args) { return this.call('dice_odds', args) }
}

class RenderHelpers {
  constructor(client) { this.client = client }

  boardUrl(opts = {}) {
    const params = new URLSearchParams()
    if (opts.fen) params.set('fen', opts.fen)
    if (opts.board) params.set('board', opts.board)
    if (opts.family) params.set('family', opts.family)
    if (opts.state) params.set('state', JSON.stringify(opts.state))
    if (opts.variant) params.set('variant', opts.variant)
    if (opts.size) params.set('size', String(opts.size))
    if (opts.highlights && Array.isArray(opts.highlights)) {
      params.set('highlights', typeof opts.highlights[0] === 'string'
        ? opts.highlights.join(',')
        : JSON.stringify(opts.highlights))
    }
    return `${this.client.base}/api/board.png?${params}`
  }

  pieceUrl(opts) {
    const params = new URLSearchParams({ set: opts.set, piece: opts.piece })
    if (opts.size) params.set('size', String(opts.size))
    return `${this.client.base}/api/piece.png?${params}`
  }

  piecesUrl(opts) {
    const params = new URLSearchParams({ set: opts.set })
    if (opts.size) params.set('size', String(opts.size))
    return `${this.client.base}/api/pieces.png?${params}`
  }

  tileUrl(opts) {
    const params = new URLSearchParams({ set: opts.set, tile: opts.tile })
    if (opts.size) params.set('size', String(opts.size))
    return `${this.client.base}/api/tile.png?${params}`
  }

  tilesUrl(opts) {
    const params = new URLSearchParams({ set: opts.set })
    if (opts.size) params.set('size', String(opts.size))
    return `${this.client.base}/api/tiles.png?${params}`
  }

  async board(opts = {}) {
    const resp = await fetch(this.boardUrl(opts))
    if (!resp.ok) throw new Error(`Board render failed: ${resp.status}`)
    return resp.arrayBuffer()
  }

  async piece(opts) {
    const resp = await fetch(this.pieceUrl(opts))
    if (!resp.ok) throw new Error(`Piece render failed: ${resp.status}`)
    return resp.arrayBuffer()
  }

  async pieces(opts) {
    const resp = await fetch(this.piecesUrl(opts))
    if (!resp.ok) throw new Error(`Pieces render failed: ${resp.status}`)
    return resp.arrayBuffer()
  }

  async tile(opts) {
    const resp = await fetch(this.tileUrl(opts))
    if (!resp.ok) throw new Error(`Tile render failed: ${resp.status}`)
    return resp.arrayBuffer()
  }

  async tiles(opts) {
    const resp = await fetch(this.tilesUrl(opts))
    if (!resp.ok) throw new Error(`Tiles render failed: ${resp.status}`)
    return resp.arrayBuffer()
  }
}

class EmbedHelpers {
  constructor(client) {
    this.client = client
    this._instances = new Map()
    this._listener = null
  }

  _ensureListener() {
    if (this._listener) return
    this._listener = (e) => {
      if (!e.data || !e.data.type || !e.data.type.startsWith('moddable:')) return
      const type = e.data.type.replace('moddable:', '')
      const widget = e.data.widget
      const instance = this._instances.get(widget)
      if (!instance) return
      if (type === 'ready') {
        instance._ready = true
        instance._pending.forEach(msg => instance._iframe.contentWindow.postMessage(msg, '*'))
        instance._pending = []
        if (instance.onReady) instance.onReady()
      }
      if (type === 'resize' && e.data.height) {
        instance._iframe.style.height = e.data.height + 'px'
        if (instance.onResize) instance.onResize(e.data.height)
      }
      if (type === 'tab' && e.data.tab) {
        if (instance.onTab) instance.onTab(e.data.tab)
      }
      if (type === 'result' && e.data.data) {
        if (instance.onResult) instance.onResult(e.data.tool, e.data.data)
      }
    }
    window.addEventListener('message', this._listener)
  }

  dice(container, opts = {}) { return this._create('dice', container, opts) }
  ti4(container, opts = {}) { return this._create('ti4', container, opts) }
  decks(container, opts = {}) { return this._create('decks', container, opts) }
  oracles(container, opts = {}) { return this._create('oracles', container, opts) }
  nukes(container, opts = {}) { return this._create('nukes', container, opts) }
  talisman(container, opts = {}) { return this._create('talisman', container, opts) }

  play(container, opts = {}) {
    return this._create('play', container, opts, this.client.engineBase + '/play/')
  }

  _create(widget, container, opts = {}, customUrl) {
    this._ensureListener()

    const el = typeof container === 'string' ? document.querySelector(container) : container
    if (!el) throw new Error(`Container not found: ${container}`)

    const params = new URLSearchParams()
    if (opts.tab) params.set('tab', opts.tab)
    if (opts.game) params.set('game', opts.game)
    if (opts.card) params.set('card', '1')
    if (opts.vars) params.set('vars', JSON.stringify(opts.vars))
    Object.entries(opts.params || {}).forEach(([k, v]) => params.set(k, v))

    const src = customUrl
      ? customUrl + (params.toString() ? '?' + params : '')
      : `${this.client.base}/embed/${widget}` + (params.toString() ? '?' + params : '')

    const iframe = document.createElement('iframe')
    iframe.src = src
    iframe.style.cssText = 'width:100%;border:none;overflow:hidden;display:block;'
    iframe.style.height = (opts.height || 600) + 'px'
    iframe.setAttribute('loading', 'lazy')
    iframe.setAttribute('allow', 'clipboard-write')
    if (opts.title) iframe.setAttribute('title', opts.title)

    el.innerHTML = ''
    el.appendChild(iframe)

    const instance = {
      widget,
      _iframe: iframe,
      _ready: false,
      _pending: [],
      onReady: opts.onReady || null,
      onResize: opts.onResize || null,
      onTab: opts.onTab || null,
      onResult: opts.onResult || null,

      setTab(tab) {
        this._send({ type: 'moddable:setTab', tab })
      },

      invoke(tool, args) {
        this._send({ type: 'moddable:invoke', tool, args })
      },

      setVars(vars) {
        this._send({ type: 'moddable:config', vars })
      },

      destroy() {
        iframe.remove()
        this._instances && this._instances.delete(widget)
      },

      _send(msg) {
        if (this._ready) {
          iframe.contentWindow.postMessage(msg, '*')
        } else {
          this._pending.push(msg)
        }
      },
    }

    instance._instances = this._instances
    this._instances.set(widget, instance)
    return instance
  }

  destroyAll() {
    this._instances.forEach(inst => inst.destroy())
    this._instances.clear()
    if (this._listener) {
      window.removeEventListener('message', this._listener)
      this._listener = null
    }
  }
}
