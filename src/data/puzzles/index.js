const modules = import.meta.glob("./*.json", { eager: true });

const puzzles = Object.values(modules)
  .map((mod) => (mod && typeof mod === "object" && "default" in mod ? mod.default : mod))
  .filter(Boolean)
  .sort((a, b) => Number(a.id) - Number(b.id));

export default puzzles;
