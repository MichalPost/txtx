import { useState } from "react";

export function usePathList(initialPaths: string[] = [""]) {
  const [paths, setPaths] = useState<string[]>(initialPaths);

  const addPath = () => setPaths((p) => [...p, ""]);
  const removePath = (i: number) => setPaths((p) => p.filter((_, idx) => idx !== i));
  const updatePath = (i: number, v: string) =>
    setPaths((p) => p.map((x, idx) => (idx === i ? v : x)));

  return { paths, addPath, removePath, updatePath };
}
