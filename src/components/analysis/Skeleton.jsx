import './MobileAnalysisReport.css'

export function HeroSkeleton() {
  return (
    <div className="ma-card" style={{ minHeight: 120 }}>
      <div className="ma-skel" style={{ height: 24, width: '70%', marginBottom: 12 }} />
      <div className="ma-skel" style={{ height: 120, width: 120, margin: '16px auto', borderRadius: '50%' }} />
      <div className="ma-skel" style={{ height: 32, width: '100%' }} />
    </div>
  )
}

export function RadarSkeleton() {
  return (
    <div className="ma-card" style={{ minHeight: 360 }}>
      <div className="ma-skel" style={{ height: 18, width: '40%', marginBottom: 12 }} />
      <div className="ma-skel" style={{ width: '100%', height: 200, marginBottom: 12 }} />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="ma-skel" style={{ height: 36, width: '100%', marginBottom: 8 }} />
      ))}
    </div>
  )
}

export function BlockSkeleton({ h = 120 }) {
  return (
    <div className="ma-card" style={{ minHeight: h }}>
      <div className="ma-skel" style={{ height: 18, width: '45%', marginBottom: 12 }} />
      <div className="ma-skel" style={{ height: Math.max(48, h - 36), width: '100%' }} />
    </div>
  )
}

export default function Skeleton({ phase = 0 }) {
  return (
    <>
      <HeroSkeleton />
      {phase >= 2 ? <RadarSkeleton /> : <BlockSkeleton h={360} />}
      {phase >= 3 ? <BlockSkeleton h={280} /> : null}
      {phase >= 4 ? <BlockSkeleton h={160} /> : null}
    </>
  )
}
