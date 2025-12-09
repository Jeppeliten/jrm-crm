/**
 * Aggregation Service
 * Hanterar summering och aggregering av data mellan mäklare, företag och varumärken
 */

/**
 * Uppdatera agent count för ett företag
 * @param {Object} db - Database connection
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} - Updated agent count
 */
async function updateCompanyAgentCount(db, companyId) {
  if (!db || !companyId) return 0;
  
  try {
    const count = await db.collection('agents_v2')
      .countDocuments({ companyId: companyId });
    
    // Uppdatera företaget med nya räkningen
    const { ObjectId } = require('mongodb');
    const query = companyId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: new ObjectId(companyId) }
      : { _id: companyId };
    
    await db.collection('companies_v2').updateOne(
      query,
      { $set: { agentCount: count, updatedAt: new Date() } }
    );
    
    return count;
  } catch (error) {
    console.error('Error updating company agent count:', error);
    return 0;
  }
}

/**
 * Uppdatera agent count för ett varumärke
 * @param {Object} db - Database connection
 * @param {string} brandId - Brand ID
 * @returns {Promise<number>} - Updated agent count
 */
async function updateBrandAgentCount(db, brandId) {
  if (!db || !brandId) return 0;
  
  try {
    const count = await db.collection('agents_v2')
      .countDocuments({ brandId: brandId });
    
    // Uppdatera varumärket med nya räkningen
    const { ObjectId } = require('mongodb');
    const query = brandId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: new ObjectId(brandId) }
      : { _id: brandId };
    
    await db.collection('brands_v2').updateOne(
      query,
      { $set: { agentCount: count, updatedAt: new Date() } }
    );
    
    return count;
  } catch (error) {
    console.error('Error updating brand agent count:', error);
    return 0;
  }
}

/**
 * Uppdatera brandIds för ett företag baserat på dess mäklare
 * @param {Object} db - Database connection
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} - Updated brand IDs
 */
async function updateCompanyBrands(db, companyId) {
  if (!db || !companyId) return [];
  
  try {
    // Hämta alla mäklare för företaget
    const agents = await db.collection('agents_v2')
      .find({ companyId: companyId })
      .toArray();
    
    // Extrahera unika brand IDs
    const brandIds = [...new Set(agents.map(a => a.brandId).filter(Boolean))];
    
    // Uppdatera företaget
    const { ObjectId } = require('mongodb');
    const query = companyId.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: new ObjectId(companyId) }
      : { _id: companyId };
    
    await db.collection('companies_v2').updateOne(
      query,
      { $set: { brandIds: brandIds, updatedAt: new Date() } }
    );
    
    return brandIds;
  } catch (error) {
    console.error('Error updating company brands:', error);
    return [];
  }
}

/**
 * Räkna totala produkter för en mäklare
 * @param {Array} products - Products array
 * @returns {number} - Total product count
 */
function countAgentProducts(products) {
  if (!Array.isArray(products)) return 0;
  return products.length;
}

/**
 * Beräkna total kostnad för mäklarpaket
 * @param {Object} brokerPackage - Broker package object
 * @returns {number} - Total cost after discount
 */
function calculateBrokerPackageCost(brokerPackage) {
  if (!brokerPackage) return 0;
  
  const totalCost = parseFloat(brokerPackage.totalCost) || 0;
  const discount = parseFloat(brokerPackage.discount) || 0;
  
  return totalCost - discount;
}

/**
 * Aggregera företagsstatistik
 * @param {Object} db - Database connection
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} - Aggregated company statistics
 */
async function getCompanyAggregatedStats(db, companyId) {
  if (!db || !companyId) {
    return {
      agentCount: 0,
      brandCount: 0,
      totalProducts: 0,
      totalBrokerPackageCost: 0,
      activeAgents: 0,
      inactiveAgents: 0
    };
  }
  
  try {
    const agents = await db.collection('agents_v2')
      .find({ companyId: companyId })
      .toArray();
    
    const brandIds = [...new Set(agents.map(a => a.brandId).filter(Boolean))];
    const totalProducts = agents.reduce((sum, agent) => 
      sum + countAgentProducts(agent.products), 0);
    const totalBrokerPackageCost = agents.reduce((sum, agent) => 
      sum + calculateBrokerPackageCost(agent.brokerPackage), 0);
    const activeAgents = agents.filter(a => a.status === 'aktiv').length;
    const inactiveAgents = agents.filter(a => a.status !== 'aktiv').length;
    
    return {
      agentCount: agents.length,
      brandCount: brandIds.length,
      brandIds: brandIds,
      totalProducts,
      totalBrokerPackageCost,
      activeAgents,
      inactiveAgents
    };
  } catch (error) {
    console.error('Error getting company aggregated stats:', error);
    return {
      agentCount: 0,
      brandCount: 0,
      totalProducts: 0,
      totalBrokerPackageCost: 0,
      activeAgents: 0,
      inactiveAgents: 0
    };
  }
}

/**
 * Aggregera varumärkesstatistik
 * @param {Object} db - Database connection
 * @param {string} brandId - Brand ID
 * @returns {Promise<Object>} - Aggregated brand statistics
 */
async function getBrandAggregatedStats(db, brandId) {
  if (!db || !brandId) {
    return {
      agentCount: 0,
      totalProducts: 0,
      totalBrokerPackageCost: 0,
      activeAgents: 0,
      inactiveAgents: 0
    };
  }
  
  try {
    const agents = await db.collection('agents_v2')
      .find({ brandId: brandId })
      .toArray();
    
    const totalProducts = agents.reduce((sum, agent) => 
      sum + countAgentProducts(agent.products), 0);
    const totalBrokerPackageCost = agents.reduce((sum, agent) => 
      sum + calculateBrokerPackageCost(agent.brokerPackage), 0);
    const activeAgents = agents.filter(a => a.status === 'aktiv').length;
    const inactiveAgents = agents.filter(a => a.status !== 'aktiv').length;
    
    return {
      agentCount: agents.length,
      totalProducts,
      totalBrokerPackageCost,
      activeAgents,
      inactiveAgents
    };
  } catch (error) {
    console.error('Error getting brand aggregated stats:', error);
    return {
      agentCount: 0,
      totalProducts: 0,
      totalBrokerPackageCost: 0,
      activeAgents: 0,
      inactiveAgents: 0
    };
  }
}

/**
 * Uppdatera alla aggregeringar efter att en mäklare skapats/uppdaterats
 * @param {Object} db - Database connection
 * @param {string} companyId - Company ID
 * @param {string} brandId - Brand ID
 */
async function updateAllAggregations(db, companyId, brandId) {
  const promises = [];
  
  if (companyId) {
    promises.push(updateCompanyAgentCount(db, companyId));
    promises.push(updateCompanyBrands(db, companyId));
  }
  
  if (brandId) {
    promises.push(updateBrandAgentCount(db, brandId));
  }
  
  try {
    await Promise.all(promises);
  } catch (error) {
    console.error('Error updating aggregations:', error);
  }
}

module.exports = {
  updateCompanyAgentCount,
  updateBrandAgentCount,
  updateCompanyBrands,
  countAgentProducts,
  calculateBrokerPackageCost,
  getCompanyAggregatedStats,
  getBrandAggregatedStats,
  updateAllAggregations
};
