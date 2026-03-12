import { useNavigate } from 'react-router-dom'

export default function OtherFeatures() {
  const nav = useNavigate()

  return (
    <div className="container page">
      <div className="card grid other-features-panel">
        <div className="other-features-header">
          <div className="other-features-title-wrap">
            <div className="section-title">Other Features</div>
            <div className="section-sub">Powerful tools to compare and evaluate your investment decisions.</div>
          </div>
        </div>

        <div className="other-features-grid">
          <div
            className="card discover-card other-feature-card"
            onClick={() => nav('/other-features/compare-stocks')}
          >
            <div className="other-feature-headline-row">
              <div className="other-feature-title">Compare Stocks</div>
              <span className="other-feature-chip">Compare</span>
            </div>
            <div className="other-feature-description">
              Compare 2 stocks using linear regression, 1-year growth chart, and next-day prediction.
            </div>
          </div>
          <div
            className="card discover-card other-feature-card"
            onClick={() => nav('/other-features/risk-categorization')}
          >
            <div className="other-feature-headline-row">
              <div className="other-feature-title">Risk Categorization</div>
              <span className="other-feature-chip">Risk</span>
            </div>
            <div className="other-feature-description">
              Categorize selected portfolio stocks into low, mid, and high investment risk.
            </div>
          </div>
          <div
            className="card discover-card other-feature-card"
            onClick={() => nav('/other-features/portfolio-clustering')}
          >
            <div className="other-feature-headline-row">
              <div className="other-feature-title">Portfolio Clustering</div>
              <span className="other-feature-chip">Cluster</span>
            </div>
            <div className="other-feature-description">
              Select a portfolio, auto-pick key columns, run normalization, PCA, UMAP, and cluster stocks.
            </div>
          </div>
          <div
            className="card discover-card other-feature-card"
            onClick={() => nav('/other-features/stock-forecast')}
          >
            <div className="other-feature-headline-row">
              <div className="other-feature-title">Stock Forecast</div>
              <span className="other-feature-chip">Forecast</span>
            </div>
            <div className="other-feature-description">
              Generate future price predictions using multiple forecasting models.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
