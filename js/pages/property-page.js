import { getState } from '../state.js';
export const propertyPage = () => {
 const { property } = getState();
 const obras = property.deliveryStatus === 'em_obras' && property.condition !== 'usado';
 const usado = property.condition === 'usado';
 return `<section class="page-grid"><header><p class="eyebrow">Etapa 2 de 5</p><h1 class="page-title" tabindex="-1">Dados do imóvel</h1><p class="page-description">Nesta versão inicial, São Paulo capital e Região Metropolitana são a região padrão.</p></header>
 <form id="property-form" class="form-card form-grid">
 <div class="field field-full"><label for="project-name">Nome do projeto (opcional)</label><input id="project-name" name="projectName" value="${property.projectName || ''}"></div>
 <div class="field"><label for="sale-value">Valor de venda</label><input id="sale-value" name="saleValue" type="number" min="0" step="0.01" inputmode="decimal" value="${property.saleValue || ''}" required></div>
 <div class="field"><label for="appraisal-value">Avaliação bancária</label><input id="appraisal-value" name="appraisalValue" type="number" min="0" step="0.01" inputmode="decimal" value="${property.appraisalValue || ''}" required></div>
 <div class="field"><label for="state">Estado</label><select id="state" name="state"><option value="SP">São Paulo</option></select></div>
 <div class="field"><label for="city">Município</label><input id="city" name="city" value="${property.city || 'São Paulo'}"></div>
 <div class="field"><label for="condition">Condição</label><select id="condition" name="condition"><option value="novo" ${property.condition==='novo'?'selected':''}>Novo</option><option value="usado" ${property.condition==='usado'?'selected':''}>Usado</option></select></div>
 <div class="field"><label for="delivery-status">Situação</label><select id="delivery-status" name="deliveryStatus"><option value="pronto" ${!obras?'selected':''}>Pronto</option><option value="em_obras" ${obras?'selected':''} ${usado?'disabled':''}>Em obras</option></select></div>
 <div class="field"><label for="construction-type">Modalidade</label><select id="construction-type" name="constructionType"><option value="sfh" ${property.constructionType==='sfh'?'selected':''}>SFH</option><option value="associativo" ${property.constructionType==='associativo'?'selected':''}>Associativo</option></select><small class="field-help">Para imóvel em obras, selecione a modalidade informada pela construtora.</small></div>
 <div class="field" id="delivery-months-field" ${obras?'':'hidden'}><label for="months-until-delivery">Meses até a entrega das chaves</label><input id="months-until-delivery" name="monthsUntilDelivery" type="number" min="2" max="60" step="1" inputmode="numeric" placeholder="Digite um valor de 2 a 60" value="${property.monthsUntilDelivery || ''}"></div>
 <div class="field"><label for="requested-term">Prazo solicitado (meses)</label><input id="requested-term" name="requestedTerm" type="number" min="1" max="420" inputmode="numeric" value="${property.requestedTerm || 420}"></div>
 <div class="actions-row field-full"><button class="button button-primary" type="submit">Calcular enquadramento</button><a class="button button-ghost" href="#/comprador">Voltar</a></div>
 </form></section>`;
};
