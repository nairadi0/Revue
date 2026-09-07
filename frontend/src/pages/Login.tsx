import { API_BASE } from '../api'
import { Button } from '../components/ui'
import { GitHubIcon, LogoMark, MemoryIcon, ShieldIcon, SparkIcon } from '../components/icons'
import s from './Login.module.css'

const FEATURES = [
  {
    icon: SparkIcon,
    title: 'Autonomous reviews',
    text: 'A tool-using agent walks every changed file and reports what it finds.',
  },
  {
    icon: MemoryIcon,
    title: 'Persistent memory',
    text: 'It remembers each repository’s patterns, so reviews sharpen over time.',
  },
  {
    icon: ShieldIcon,
    title: 'Severity triage',
    text: 'Findings arrive classified by severity and category, with a suggested fix.',
  },
]

function Login() {
  const handleLogin = () => {
    window.location.href = `${API_BASE}/auth/login`
  }

  return (
    <div className={s.page}>
      <div className={s.glow} />
      <div className={s.inner}>
        <div className={s.brand}>
          <LogoMark size={26} />
          Revue
        </div>

        <h1 className={s.title}>
          Code review that <span className={s.accent}>remembers</span>
        </h1>
        <p className={s.tagline}>
          Connect a GitHub repository and let the agent review your pull requests — building up memory of your codebase
          with every run.
        </p>

        <div className={s.action}>
          <Button variant="primary" size="lg" onClick={handleLogin}>
            <GitHubIcon />
            Continue with GitHub
          </Button>
        </div>

        <div className={s.features}>
          {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
            <div key={title} className={s.feature}>
              <span className={s.featureIcon}>
                <FeatureIcon size={15} />
              </span>
              <div>
                <div className={s.featureTitle}>{title}</div>
                <div className={s.featureText}>{text}</div>
              </div>
            </div>
          ))}
        </div>

        <p className={s.footnote}>
          Revue reads your pull requests and adds a webhook to watch for new ones. It never pushes code.
        </p>
      </div>
    </div>
  )
}

export default Login
