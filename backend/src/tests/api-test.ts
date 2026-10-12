import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';
let authToken = '';

const client = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true // Don't throw on any status
});

async function runTests() {
  console.log('🧪 Starting API Tests...\n');

  try {
    // Test 1: Login
    console.log('1️⃣ Testing Login...');
    const loginRes = await client.post('/auth/login', {
      username: 'admin',
      password: 'Admin123456'
    });

    if (loginRes.status === 200 && loginRes.data.data.token.access_token) {
      authToken = loginRes.data.data.token.access_token;
      console.log('✅ Login successful');
      console.log(`   Token: ${authToken.substring(0, 20)}...`);
    } else {
      console.log('❌ Login failed:', loginRes.status, loginRes.data);
      return;
    }

    // Set auth header
    client.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    // Test 2: Get Profile
    console.log('\n2️⃣ Testing Get Profile...');
    const profileRes = await client.get('/auth/profile');
    if (profileRes.status === 200) {
      console.log('✅ Profile retrieved');
      console.log(`   User: ${profileRes.data.data.username} (${profileRes.data.data.role})`);
    } else {
      console.log('❌ Failed to get profile:', profileRes.status);
    }

    // Test 3: Get AZS List
    console.log('\n3️⃣ Testing Get AZS List...');
    const azsRes = await client.get('/azs');
    if (azsRes.status === 200 && azsRes.data.data) {
      console.log(`✅ Retrieved ${azsRes.data.data.length} AZS stations`);
      azsRes.data.data.forEach((azs: any, i: number) => {
        console.log(`   ${i + 1}. ${azs.name}`);
      });
    } else {
      console.log('❌ Failed to get AZS:', azsRes.status);
    }

    // Test 4: Get Prices
    console.log('\n4️⃣ Testing Get Prices...');
    const pricesRes = await client.get('/prices');
    if (pricesRes.status === 200 && pricesRes.data.data) {
      console.log(`✅ Retrieved ${pricesRes.data.data.length} prices`);
      pricesRes.data.data.slice(0, 3).forEach((price: any) => {
        console.log(`   ${price.fuel_type}: ${price.price}р`);
      });
    } else {
      console.log('❌ Failed to get prices:', pricesRes.status);
    }

    // Test 5: Get Recommendations
    console.log('\n5️⃣ Testing Get Recommendations...');
    const recsRes = await client.get('/recommendations');
    if (recsRes.status === 200 && recsRes.data.data) {
      console.log(`✅ Retrieved ${recsRes.data.data.length} recommendations`);
      recsRes.data.data.slice(0, 2).forEach((rec: any) => {
        console.log(`   ${rec.type}: ${rec.fuel_type} (${rec.confidence})`);
      });
    } else {
      console.log('❌ Failed to get recommendations:', recsRes.status);
    }

    // Test 6: Get Admin Stats
    console.log('\n6️⃣ Testing Get Admin Stats...');
    const statsRes = await client.get('/admin/stats/overall');
    if (statsRes.status === 200) {
      console.log('✅ Retrieved admin stats');
      console.log(`   Total AZS: ${statsRes.data.data.totalAZS}`);
      console.log(`   Total Recommendations: ${statsRes.data.data.totalRecommendations}`);
      console.log(`   Avg Price: ${statsRes.data.data.avgPrice}р`);
    } else {
      console.log('❌ Failed to get stats:', statsRes.status);
    }

    // Test 7: Logout
    console.log('\n7️⃣ Testing Logout...');
    const logoutRes = await client.post('/auth/logout');
    if (logoutRes.status === 200) {
      console.log('✅ Logout successful');
    } else {
      console.log('❌ Logout failed:', logoutRes.status);
    }

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

runTests();
