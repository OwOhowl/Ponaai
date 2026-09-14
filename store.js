/**
 * store.js -PonaAI Tilanhallinta
 */

export const EMOTIONS = [
  { name: "Rauhallinen", emoji: "😌" },
  { name: "Iloinen", emoji: "😊" },
  { name: "Huvittunut", emoji: "😏" },
  { name:"Ärsyyntynyt", emoji: "😒" },
  { name: "Utelias", emoji: "🧐" },
  { name: "Innostunut", emoji: "🤩" },
  { name: "Keskittynyt", emoji: "🤔" },
  { name: "Yllättynyt", emoji:"😮" },
  { name: "Itsevarma", emoji: "😎" },
  {name: "Pirullinen", emoji: "😈" },
  { name: "Rakastunut", emoji: "🥰" },
  { name: "Ihastunut", emoji: "😍" },
  {name: "Vihainen", emoji: "😡" },
  { name: "Tylsistynyt", emoji:"🥱" },
  { name: "Mustasukkainen", emoji: "😤" },
  {name: "Heltynyt", emoji: "🥺" },
  { name: "Ujostunut", emoji:"😳" }
];

const STORAGE_KEY = "ponaai_state_v2";

const defaultState ={
  projects: [
    {
      id: "default",
      name: "Pääprojekti",messages: [],
      assets: [],
      memories: []
    }
  ],
  activeProjectId: "default",
  settings: {
    model: "gemini-3.8-flash",
    personality: "human",
    thinkingLevel: "medium",
    blockLevel: "none",
    voice: "Kore",userName: "Pönä",
    userProfile: {
      name: "Pönä",
      aiName: "PonaAI",
      about: "Pönä on luojani.",
      instructions: "Ole suora, inhimillinen ja anna toimivaa koodia."
    }
  }
};

export class Store {constructor() {
    this.state = this.load();
    this.listeners = [];}

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);const state = Object.assign({}, defaultState, parsed);
      state.settings = Object.assign({}, defaultState.settings, parsed.settings || {});
      return state;
    } catch (e) {
      console.error("Virhe ladattaessa tilaa:", e);
      return structuredClone(defaultState);}
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state));
      this.notify();
    } catch (e) {
      console.error("Virhe tallennettaessa tilaa:", e);
    }
  }

  ensure() {if (!this.state.projects || !this.state.projects.length) {
      this.state.projects = structuredClone(defaultState.projects);
      this.state.activeProjectId = "default";
      this.save();
    }
  }

  get settings() {
    return this.state.settings;}

  set settings(val) {
    this.state.settings = Object.assign({}, this.state.settings, val);
    this.save();
  }

  projects() {
    return this.state.projects || [];}

  active() {
    return (
      this.state.projects.find(p => p.id === this.state.activeProjectId) ||
      this.state.projects[0]
    );
  }activeProject(id) {
    this.state.activeProjectId = id;
    this.save();
  }newProject(name = "Uusi projekti") {
    const id = "proj_" + Date.now();this.state.projects.push({
      id,
      name,
      messages: [],
      assets: [],
      memories: []
    });
    this.state.activeProjectId = id;
    this.save();
    return id;
  }

  deleteProject(id) {
    if (this.state.projects.length <= 1) return;
    this.state.projects = this.state.projects.filter(p=> p.id !== id);
    if (this.state.activeProjectId === id) {
      this.state.activeProjectId = this.state.projects[0].id;
    }
    this.save();
  }

  push(message) {
    const p = this.active();
    if (p) {if (!p.messages) p.messages = [];
      p.messages.push(message);this.save();
    }
  }

  addAsset(asset) {
    const p = this.active();
    if (p) {
      if (!p.assets) p.assets = [];
      p.assets.push(asset);
      this.save();
    }
  }

  getAssets() {
    constp = this.active();
    return p ? (p.assets || []) : [];
  }

  removeAsset(assetId) {
    const p = this.active();
    if (p && p.assets) {
      p.assets = p.assets.filter(a => a.id !== assetId);
      this.save();
    }}

  addMemory(text, author = "user") {
    const p = this.active();
    if (p) {
      if (!p.memories) p.memories = [];
      p.memories.push({ text, author, createdAt: Date.now() });
      this.save();
    }
  }getMemories() {
    const p = this.active();
    return p ? (p.memories || []) : [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);};
  }

  notify() {
    for (const listener of this.listeners) {
      try {listener(this.state);
      } catch (e) {
        console.error("Listener-virhe:", e);
      }
    }
  }
}

export const store = new Store();