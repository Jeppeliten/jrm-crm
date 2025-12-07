/**
 * CRM Routes - Avtalhantering integrerat i CRM
 */

const express = require('express');
const router = express.Router();
const ContractService = require('../services/contract-service');
const authMiddleware = require('../middleware/auth-middleware');

const contractService = new ContractService();

/**
 * FRÅN CRM: Skicka avtal till kund
 * Används av säljare när en deal är klar för avtal
 */
router.post('/deals/:dealId/send-contract', 
  authMiddleware.requireRole('Salesperson'),
  async (req, res) => {
    try {
      const { dealId } = req.params;
      const { serviceType, customizations } = req.body;
      
      // 1. Hämta deal-information från CRM
      const deal = await crmService.getDeal(dealId);
      
      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      
      // 2. Validera att dealen är redo för avtal
      if (deal.status !== 'negotiation' && deal.status !== 'proposal') {
        return res.status(400).json({ 
          error: 'Deal not ready for contract',
          currentStatus: deal.status 
        });
      }
      
      // 3. Hämta tjänstedefinition
      const service = await serviceDefinitions.get(serviceType);
      
      // 4. Applicera ev. kundanpassningar
      if (customizations) {
        service.price = customizations.price || service.price;
        service.maxUsers = customizations.maxUsers || service.maxUsers;
      }
      
      // 5. Skapa och skicka avtal
      const contract = await contractService.createAndSendContract(deal, service);
      
      // 6. Uppdatera deal-status i CRM
      await crmService.updateDeal(dealId, {
        status: 'contract_sent',
        contractId: contract.id,
        contractSentDate: new Date()
      });
      
      res.json({
        success: true,
        contract: {
          id: contract.id,
          status: contract.status,
          sentTo: contract.email,
          service: contract.service.name
        },
        message: `Avtal skickat till ${deal.customer.email}`
      });
      
    } catch (error) {
      console.error('Error sending contract:', error);
      res.status(500).json({ 
        error: 'Failed to send contract',
        message: error.message 
      });
    }
  }
);

/**
 * Hämta avtalsstatus för en deal
 */
router.get('/deals/:dealId/contract',
  authMiddleware.requireRole('Salesperson'),
  async (req, res) => {
    try {
      const { dealId } = req.params;
      const contract = await contractService.getContractByDealId(dealId);
      
      if (!contract) {
        return res.status(404).json({ error: 'No contract found for this deal' });
      }
      
      res.json({
        contract: {
          id: contract.id,
          status: contract.status,
          service: contract.service,
          sentDate: contract.signing.sentDate,
          signedDate: contract.signing.signedDate,
          documentUrl: contract.signing.documentUrl
        }
      });
      
    } catch (error) {
      console.error('Error fetching contract:', error);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  }
);

/**
 * Lista alla avtal (för admin)
 */
router.get('/contracts',
  authMiddleware.requireRole('Admin'),
  async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      
      const contracts = await contractService.listContracts({
        status,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      res.json(contracts);
      
    } catch (error) {
      console.error('Error listing contracts:', error);
      res.status(500).json({ error: 'Failed to list contracts' });
    }
  }
);

/**
 * Webhook från Scrive när avtal signeras
 */
router.post('/webhooks/scrive/signed',
  async (req, res) => {
    try {
      console.log('Scrive webhook received:', req.body);
      
      // Verifiera att det är från Scrive (implementera signatur-validering)
      // const isValid = scriveService.verifyWebhook(req.headers, req.body);
      // if (!isValid) {
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }
      
      // Hantera signerat avtal
      const contract = await contractService.handleScriveWebhook(req.body);
      
      // Skicka notis till säljaren
      await notificationService.notifySalesperson(contract.createdBy, {
        type: 'contract_signed',
        message: `${contract.companyName} har signerat avtalet!`,
        dealId: contract.dealId
      });
      
      res.json({ received: true });
      
    } catch (error) {
      console.error('Error handling Scrive webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  }
);

/**
 * Webhook när avtal avbryts
 */
router.post('/webhooks/scrive/cancelled',
  async (req, res) => {
    try {
      const { document_id } = req.body;
      
      const contract = await contractService.findContractByScriveId(document_id);
      
      if (contract) {
        await contractService.updateContract({
          ...contract,
          status: 'cancelled'
        });
        
        // Notifiera säljaren
        await notificationService.notifySalesperson(contract.createdBy, {
          type: 'contract_cancelled',
          message: `${contract.companyName} avbröt signeringen`,
          dealId: contract.dealId
        });
      }
      
      res.json({ received: true });
      
    } catch (error) {
      console.error('Error handling cancellation:', error);
      res.status(500).json({ error: 'Failed to process cancellation' });
    }
  }
);

/**
 * Skicka påminnelse om osignerat avtal
 */
router.post('/contracts/:contractId/remind',
  authMiddleware.requireRole('Salesperson'),
  async (req, res) => {
    try {
      const { contractId } = req.params;
      const contract = await contractService.getContract(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      if (contract.status !== 'sent') {
        return res.status(400).json({ 
          error: 'Cannot remind for this contract',
          status: contract.status 
        });
      }
      
      // Skicka påminnelse-email
      await contractService.sendReminderEmail(contract);
      
      // Logga i CRM
      await crmService.logActivity(contract.dealId, {
        type: 'contract_reminder_sent',
        description: `Påminnelse skickad till ${contract.email}`
      });
      
      res.json({ success: true, message: 'Reminder sent' });
      
    } catch (error) {
      console.error('Error sending reminder:', error);
      res.status(500).json({ error: 'Failed to send reminder' });
    }
  }
);

module.exports = router;
