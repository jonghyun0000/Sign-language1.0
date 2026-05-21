/**
 * 애플리케이션 진입점
 * Application entry point
 */

import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

/**
 * 주의: React.StrictMode를 의도적으로 사용하지 않습니다.
 * StrictMode는 개발 모드에서 컴포넌트를 두 번 마운트하는데,
 * 이로 인해 카메라 스트림이 즉시 해제되고 재요청되면서
 * getUserMedia가 충돌할 수 있습니다.
 *
 * Note: We intentionally do not use React.StrictMode.
 * StrictMode double-mounts components in dev mode, which causes
 * the camera stream to be immediately released and re-requested,
 * potentially causing getUserMedia conflicts.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
