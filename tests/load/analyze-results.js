#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Analyze k6 load test results and check against thresholds
 */

function analyzeResults(resultsFile) {
  if (!fs.existsSync(resultsFile)) {
    console.error(`❌ Results file not found: ${resultsFile}`);
    process.exit(1);
  }

  let results;
  try {
    const data = fs.readFileSync(resultsFile, 'utf8');
    const lines = data.split('\n');

    // Parse JSON Lines format
    const metrics = {};
    lines.forEach((line) => {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          if (entry.metric) {
            if (!metrics[entry.metric]) {
              metrics[entry.metric] = [];
            }
            metrics[entry.metric].push(entry);
          }
        } catch (e) {
          // Skip invalid lines
        }
      }
    });

    results = metrics;
  } catch (error) {
    console.error(`❌ Failed to parse results: ${error.message}`);
    process.exit(1);
  }

  // Define thresholds
  const thresholds = {
    'http_req_duration': {
      'p95': 500,
      'p99': 1000,
      'avg': 400,
    },
    'http_req_failed': {
      'rate': 0.1,
    },
    'errors': {
      'rate': 0.1,
    },
    'group_duration': {
      'p95': 1500,
      'avg': 1000,
    },
  };

  // Analyze results
  console.log('\n📊 Load Test Analysis');
  console.log('═'.repeat(80));

  let hasFailed = false;

  // HTTP Request Duration
  if (results.http_req_duration) {
    console.log('\n⏱️  HTTP Request Duration');
    const durations = results.http_req_duration
      .map((d) => d.data?.value || 0)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    if (durations.length > 0) {
      const p95 = durations[Math.floor(durations.length * 0.95)];
      const p99 = durations[Math.floor(durations.length * 0.99)];
      const avg = durations.reduce((a, b) => a + b) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);

      console.log(`  Average:  ${avg.toFixed(2)}ms ${checkThreshold(avg, thresholds.http_req_duration.avg, '<=')}`);
      console.log(`  p95:      ${p95.toFixed(2)}ms ${checkThreshold(p95, thresholds.http_req_duration.p95, '<=')}`);
      console.log(`  p99:      ${p99.toFixed(2)}ms ${checkThreshold(p99, thresholds.http_req_duration.p99, '<=')}`);
      console.log(`  Min:      ${min.toFixed(2)}ms`);
      console.log(`  Max:      ${max.toFixed(2)}ms`);

      if (p95 > thresholds.http_req_duration.p95 || p99 > thresholds.http_req_duration.p99) {
        hasFailed = true;
      }
    }
  }

  // Error Rate
  if (results.http_req_failed) {
    console.log('\n❌ Error Rate');
    const errorCount = results.http_req_failed.length;
    const errorRate = errorCount / Math.max(results.http_reqs?.length || 1, 1);

    console.log(`  Failed Requests: ${errorCount}`);
    console.log(`  Error Rate:      ${(errorRate * 100).toFixed(2)}% ${checkThreshold(errorRate, thresholds.http_req_failed.rate, '<=')}`);

    if (errorRate > thresholds.http_req_failed.rate) {
      hasFailed = true;
    }
  }

  // Request Count
  if (results.http_reqs) {
    console.log('\n📈 Request Statistics');
    console.log(`  Total Requests: ${results.http_reqs.length}`);
    console.log(`  Requests/sec:   ${(results.http_reqs.length / 100).toFixed(2)}`); // Assuming 100s test duration
  }

  // Group Duration
  if (results.group_duration) {
    console.log('\n📋 Group Duration');
    const groupDurations = results.group_duration
      .map((d) => ({ name: d.data?.name, value: d.data?.value || 0 }))
      .filter((d) => d.value > 0);

    const groupedByName = {};
    groupDurations.forEach((d) => {
      if (!groupedByName[d.name]) {
        groupedByName[d.name] = [];
      }
      groupedByName[d.name].push(d.value);
    });

    Object.entries(groupedByName).forEach(([name, values]) => {
      const avg = values.reduce((a, b) => a + b) / values.length;
      const p95 = values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)];
      console.log(`  ${name}:`);
      console.log(`    Avg:  ${avg.toFixed(2)}ms ${checkThreshold(avg, thresholds.group_duration.avg, '<=')}`);
      console.log(`    p95:  ${p95.toFixed(2)}ms ${checkThreshold(p95, thresholds.group_duration.p95, '<=')}`);

      if (avg > thresholds.group_duration.avg || p95 > thresholds.group_duration.p95) {
        hasFailed = true;
      }
    });
  }

  console.log('\n' + '═'.repeat(80));

  if (hasFailed) {
    console.log('\n❌ Load test FAILED - Some thresholds were exceeded');
    process.exit(1);
  } else {
    console.log('\n✅ Load test PASSED - All thresholds met');
    process.exit(0);
  }
}

function checkThreshold(value, threshold, operator) {
  let passed = false;

  switch (operator) {
    case '<=':
      passed = value <= threshold;
      break;
    case '>=':
      passed = value >= threshold;
      break;
    case '<':
      passed = value < threshold;
      break;
    case '>':
      passed = value > threshold;
      break;
  }

  return passed ? '✅' : '❌';
}

// Run analysis
const resultsFile = process.argv[2] || 'load-test-results.json';
analyzeResults(resultsFile);
