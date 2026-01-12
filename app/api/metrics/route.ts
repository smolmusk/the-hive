import { NextResponse } from 'next/server';

import { getMetricsSnapshot } from '@/lib/metrics';

export const GET = async () => {
  if (process.env.ENABLE_METRICS_ENDPOINT !== 'true') {
    return new NextResponse('Not Found', { status: 404 });
  }
  const response = NextResponse.json(getMetricsSnapshot());
  response.headers.set('Cache-Control', 'no-store');
  return response;
};
