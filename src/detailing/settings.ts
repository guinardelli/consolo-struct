import { z } from "zod";

// "consolo": loops or welded bar at the tip (NBR 9062). "beam": top and bottom bars bent at both ends.
export const barArrangementSchema = z.enum(["consolo", "beam"]);
export type BarArrangement = z.infer<typeof barArrangementSchema>;
export const detailingSchema = z.object({
  revision: z.string().max(20).default("R00"),
  notes: z.string().max(2000).default(""),
  supportHookProjection: z.number().finite().min(0).max(6000).default(250),
  supportHookTail: z.number().finite().min(0).max(6000).default(200),
  stitchEmbedment: z.number().finite().min(0).max(6000).default(200),
  secondLoopDiameter: z.number().finite().min(0).max(3000).default(0),
  pins: z.number().int().min(0).max(20).default(0),
  pinDiameter: z.number().finite().min(6.3).max(40).default(16),
  pinEmbedment: z.number().finite().min(0).max(3000).default(200),
  pinProjection: z.number().finite().min(0).max(3000).default(150),
  pinSpacing: z.number().finite().min(0).max(6000).default(0),
  pinCenterOffset: z.number().finite().min(-3000).max(3000).default(0),
  // Missing fields keep the detailing of projects saved before this option.
  barArrangement: barArrangementSchema.default("consolo"),
  beamBottomCount: z.number().int().min(2).max(20).default(2),
  beamBottomDiameter: z.number().finite().min(5).max(25).default(10),
});
export type DetailingSettings = z.infer<typeof detailingSchema>;
export const defaultDetailing = () => detailingSchema.parse({});
