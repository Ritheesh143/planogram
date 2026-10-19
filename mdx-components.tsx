import type { MDXComponents } from "mdx/types";
import { Depth } from "@/components/lesson/Depth";
import { Lineage } from "@/components/lesson/Lineage";
import { Exercise, KeyIdea, QA, Solution, Trap } from "@/components/lesson/Exercise";
import { Predict } from "@/components/lesson/Predict";
import { PyRunner } from "@/components/lesson/PyRunner";
import { Section } from "@/components/lesson/Section";
import { Step, Steps } from "@/components/lesson/Steps";
import { BoostingByHand, BoostingOverfit } from "@/components/viz/BoostingByHand";
import { GossDemo, HistogramSplit, LevelVsLeaf, TargetLeakage } from "@/components/viz/BoostingInternals";
import { GBMFunctionSpace, GBMKnobs } from "@/components/viz/BoostingLab";
import { CIRepeat } from "@/components/viz/CIRepeat";
import { CountingWorlds, FraudSimulation } from "@/components/viz/CountingWorlds";
import { FailureLab } from "@/components/viz/FailureLab";
import { CollinearCloud, RidgeLassoGeometry } from "@/components/viz/LinearKnobs";
import { LinRegPlayground } from "@/components/viz/LinRegPlayground";
import { LossMirror, LossSimulation } from "@/components/viz/LossMirror";
import { BackpropStep, MLPTrainer, ReluKinks } from "@/components/viz/MLPLab";
import { BoxesVsBends } from "@/components/viz/TreeVsMLP";
import { BaggingDemo, ImpurityCurves, TreeDepthPlayground, TreeSplitByHand } from "@/components/viz/TreePlayground";
import { LikelihoodDial, LikelihoodSimulation } from "@/components/viz/LikelihoodDial";

// Lesson building blocks are available in every MDX file without imports.
const components: MDXComponents = {
  h2: (p) => <h3 className="mt-6 text-lg font-semibold tracking-tight" {...p} />,
  h3: (p) => <h4 className="mt-4 font-semibold" {...p} />,
  p: (p) => <p className="leading-7 text-[15.5px]" {...p} />,
  ul: (p) => <ul className="list-disc space-y-1.5 pl-6 leading-7 text-[15.5px]" {...p} />,
  ol: (p) => <ol className="list-decimal space-y-1.5 pl-6 leading-7 text-[15.5px]" {...p} />,
  a: (p) => <a className="text-accent underline-offset-2 hover:underline" {...p} />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  blockquote: (p) => (
    <blockquote className="border-l-2 border-axis pl-4 italic text-ink-2" {...p} />
  ),
  table: (p) => (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm tabular" {...p} />
    </div>
  ),
  thead: (p) => <thead className="bg-surface-2 text-left" {...p} />,
  th: (p) => <th className="px-3 py-2 font-medium" {...p} />,
  td: (p) => <td className="border-t border-line px-3 py-2" {...p} />,
  code: (p) => <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]" {...p} />,
  pre: (p) => (
    <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-[13px] [&_code]:bg-transparent [&_code]:p-0" {...p} />
  ),
  Section,
  Depth,
  Steps,
  Step,
  Predict,
  Exercise,
  Solution,
  KeyIdea,
  Trap,
  QA,
  PyRunner,
  CountingWorlds,
  CIRepeat,
  LikelihoodDial,
  BoostingByHand,
  BoostingOverfit,
  FraudSimulation,
  LikelihoodSimulation,
  Lineage,
  FailureLab,
  LinRegPlayground,
  RidgeLassoGeometry,
  CollinearCloud,
  TreeSplitByHand,
  TreeDepthPlayground,
  ImpurityCurves,
  BaggingDemo,
  LossMirror,
  LossSimulation,
  GBMFunctionSpace,
  GBMKnobs,
  HistogramSplit,
  GossDemo,
  LevelVsLeaf,
  TargetLeakage,
  ReluKinks,
  BackpropStep,
  MLPTrainer,
  BoxesVsBends,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
