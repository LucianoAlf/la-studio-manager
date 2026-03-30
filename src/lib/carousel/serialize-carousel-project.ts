import { deserializeComposition } from "@/lib/types/layer-composition";
import type { CarouselProject } from "./types";

export function serializeCarouselProject(project: CarouselProject): CarouselProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    slides: project.slides.map((slide, index) => ({
      ...slide,
      index,
      composition: deserializeComposition(slide.composition),
    })),
  };
}
