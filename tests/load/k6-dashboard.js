import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('http_req_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const activeConnections = new Gauge('active_connections');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // ramp up to 10 users
    { duration: '30s', target: 50 },   // ramp up to 50 users
    { duration: '20s', target: 100 },  // ramp up to 100 users
    { duration: '30s', target: 100 },  // stay at 100 users
    { duration: '10s', target: 0 },    // ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.1'],
  },
  ext: {
    loadimpact: {
      name: 'AZS Dashboard Load Test',
      projectID: 3451192,
      name: 'Main Dashboard Flow',
    },
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3000/api';
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

// Test data
const stations = [
  { id: 'АЗС 172', name: 'АЗС 172' },
  { id: 'АЗС 173', name: 'АЗС 173' },
  { id: 'АЗС 603', name: 'АЗС 603' },
  { id: 'АЗС 604', name: 'АЗС 604' },
  { id: 'АЗС 606', name: 'АЗС 606' },
];

export default function (data) {
  const station = stations[Math.floor(Math.random() * stations.length)];

  // Test 1: Dashboard load
  group('Dashboard - Load Overview', () => {
    const res = http.get(`${API_URL}/dashboard/overview`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has data': (r) => r.json('data') !== null,
    });

    if (res.status === 200) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 2: Get station details
  group('Stations - Get Details', () => {
    const res = http.get(`${API_URL}/stations/${station.id}`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
      'has station data': (r) => r.json('data.station_id') !== null,
    });

    if (res.status === 200) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 3: Get station prices
  group('Prices - Get Station Prices', () => {
    const res = http.get(
      `${API_URL}/prices?station_id=${station.id}&days=30`
    );
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
      'has prices array': (r) => r.json('data') && Array.isArray(r.json('data')),
    });

    if (res.status === 200) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 4: Get competitors data
  group('Competitors - Get Data', () => {
    const res = http.get(`${API_URL}/competitors/${station.id}?days=30`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 800ms': (r) => r.timings.duration < 800,
    });

    if (res.status === 200) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 5: Get analytics
  group('Analytics - Get Metrics', () => {
    const res = http.get(
      `${API_URL}/analytics/metrics?station_id=${station.id}&startDate=2025-01-01&endDate=2025-03-01`
    );
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 1500ms': (r) => r.timings.duration < 1500,
      'has metrics': (r) => r.json('data') !== null,
    });

    if (res.status === 200) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 6: Get promotions
  group('Promotions - Get Active', () => {
    const res = http.get(`${API_URL}/promotions?station_id=${station.id}`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (res.status === 200) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);
    sleep(1);
  });

  // Test 7: Get recommendations
  group('Recommendations - Get AI Suggestions', () => {
    const res = http.get(
      `${API_URL}/recommendations/${station.id}?metric=price&period=monthly`
    );
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    if (res.status === 200) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);
    sleep(2);
  });

  // Update active connections gauge
  activeConnections.add(__VU);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';
  const colors = options?.enableColors || false;

  let summary = `
    ================================================================================
    k6 Test Summary
    ================================================================================

    Execution & Environment:
    ${indent}Total Duration: ${(data.state.testRunDurationMs / 1000).toFixed(2)}s
    ${indent}VUs Peak: ${data.metrics.vus_max?.values?.value || 0}

    HTTP Metrics:
    ${indent}Total Requests: ${data.metrics.http_reqs?.value || 0}
    ${indent}Failed Requests: ${data.metrics.http_req_failed?.value || 0}

    Performance:
    ${indent}p(95) Response Time: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(0)}ms
    ${indent}p(99) Response Time: ${(data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(0)}ms
    ${indent}Avg Response Time: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(0)}ms
    ${indent}Min Response Time: ${(data.metrics.http_req_duration?.values?.min || 0).toFixed(0)}ms
    ${indent}Max Response Time: ${(data.metrics.http_req_duration?.values?.max || 0).toFixed(0)}ms

    Custom Metrics:
    ${indent}Successful Requests: ${data.metrics.successful_requests?.value || 0}
    ${indent}Failed Requests: ${data.metrics.failed_requests?.value || 0}
    ${indent}Error Rate: ${((data.metrics.errors?.value || 0) * 100).toFixed(2)}%

    ================================================================================
  `;

  return summary;
}
