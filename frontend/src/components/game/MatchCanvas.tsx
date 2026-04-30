import { useMemo } from 'react';
import type { RuntimeMatchState } from '../../types/api';

type MatchCanvasProps = {
  match: RuntimeMatchState;
};

function themeColors(theme: RuntimeMatchState['settings']['theme']) {
  if (theme === 'neon') {
    return {
      background: '#05111A',
      lines: '#00E8FF',
      paddle: '#00FFC8',
      ball: '#F5FBFF',
      power: '#FFD166',
    };
  }

  if (theme === 'sunset') {
    return {
      background: '#2A0F3F',
      lines: '#FFD2A5',
      paddle: '#FF8A5B',
      ball: '#FFF4D6',
      power: '#90F2FF',
    };
  }

  return {
    background: '#0A1320',
    lines: '#94A3B8',
    paddle: '#38BDF8',
    ball: '#E2E8F0',
    power: '#F59E0B',
  };
}

export function MatchCanvas({ match }: MatchCanvasProps) {
  const canvasBackground = useMemo(
    () => themeColors(match.settings.theme).background,
    [match.settings.theme],
  );

  const colors = useMemo(() => themeColors(match.settings.theme), [match.settings.theme]);

  const width = match.dimensions.width;
  const height = match.dimensions.height;

  const leftPaddleX = 20;
  const rightPaddleX = width - 20 - match.dimensions.paddleWidth;

  return (
    <div className="match-canvas-wrapper" style={{ background: canvasBackground }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="match-canvas"
        role="img"
        aria-label="Live Pong match"
      >
        <rect x={0} y={0} width={width} height={height} fill={colors.background} />

        <line
          x1={width / 2}
          y1={0}
          x2={width / 2}
          y2={height}
          stroke={colors.lines}
          strokeDasharray="10 12"
          strokeWidth={4}
          opacity={0.4}
        />

        <rect
          x={leftPaddleX}
          y={match.players.left.paddleY}
          width={match.dimensions.paddleWidth}
          height={match.settings.paddleSize}
          rx={5}
          fill={colors.paddle}
        />

        <rect
          x={rightPaddleX}
          y={match.players.right.paddleY}
          width={match.dimensions.paddleWidth}
          height={match.settings.paddleSize}
          rx={5}
          fill={colors.paddle}
        />

        <circle
          cx={match.ball.x}
          cy={match.ball.y}
          r={match.dimensions.ballRadius}
          fill={colors.ball}
        />

        {match.powerUp ? (
          <circle
            cx={match.powerUp.x}
            cy={match.powerUp.y}
            r={14}
            fill={colors.power}
            opacity={0.9}
          />
        ) : null}

        <text
          x={width / 4}
          y={56}
          textAnchor="middle"
          fontSize="48"
          fontWeight="700"
          fill={colors.lines}
        >
          {match.score.left}
        </text>

        <text
          x={(width / 4) * 3}
          y={56}
          textAnchor="middle"
          fontSize="48"
          fontWeight="700"
          fill={colors.lines}
        >
          {match.score.right}
        </text>
      </svg>

      <div className="canvas-legends">
        <span>
          L: {match.players.left.username}
          {match.players.left.connected ? '' : ' (offline)'}
        </span>
        <span>
          R: {match.players.right.username}
          {match.players.right.connected ? '' : ' (offline)'}
        </span>
      </div>
    </div>
  );
}
