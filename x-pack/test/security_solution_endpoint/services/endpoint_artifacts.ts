/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  CreateExceptionListItemSchema,
  CreateExceptionListSchema,
  ExceptionListItemSchema,
} from '@kbn/securitysolution-io-ts-list-types';
import {
  ENDPOINT_ARTIFACT_LISTS,
  ENDPOINT_ARTIFACT_LIST_IDS,
  EXCEPTION_LIST_ITEM_URL,
  EXCEPTION_LIST_URL,
} from '@kbn/securitysolution-list-constants';
import { Response } from 'superagent';
import { ExceptionsListItemGenerator } from '@kbn/security-solution-plugin/common/endpoint/data_generators/exceptions_list_item_generator';
import { TRUSTED_APPS_EXCEPTION_LIST_DEFINITION } from '@kbn/security-solution-plugin/public/management/pages/trusted_apps/constants';
import { EndpointError } from '@kbn/security-solution-plugin/common/endpoint/errors';
import { EVENT_FILTER_LIST_DEFINITION } from '@kbn/security-solution-plugin/public/management/pages/event_filters/constants';
import { HOST_ISOLATION_EXCEPTIONS_LIST_DEFINITION } from '@kbn/security-solution-plugin/public/management/pages/host_isolation_exceptions/constants';
import { BLOCKLISTS_LIST_DEFINITION } from '@kbn/security-solution-plugin/public/management/pages/blocklist/constants';
import { ManifestConstants } from '@kbn/security-solution-plugin/server/endpoint/lib/artifacts';
import { FtrService } from '../../functional/ftr_provider_context';
import { InternalUnifiedManifestSchemaResponseType } from '../apps/integrations/mocks';

export interface ArtifactTestData {
  artifact: ExceptionListItemSchema;
  cleanup: () => Promise<void>;
}

export class EndpointArtifactsTestResources extends FtrService {
  private readonly exceptionsGenerator = new ExceptionsListItemGenerator();
  private readonly supertest = this.ctx.getService('supertest');
  private readonly log = this.ctx.getService('log');
  private readonly esClient = this.ctx.getService('es');

  private getHttpResponseFailureHandler(
    ignoredStatusCodes: number[] = []
  ): (res: Response) => Promise<Response> {
    return async (res) => {
      if (!res.ok && !ignoredStatusCodes.includes(res.status)) {
        throw new EndpointError(JSON.stringify(res.error, null, 2));
      }

      return res;
    };
  }

  private async ensureListExists(listDefinition: CreateExceptionListSchema): Promise<void> {
    // attempt to create it and ignore 409 (already exists) errors
    await this.supertest
      .post(EXCEPTION_LIST_URL)
      .set('kbn-xsrf', 'true')
      .send(listDefinition)
      .then(this.getHttpResponseFailureHandler([409]));
  }

  private async createExceptionItem(
    createPayload: CreateExceptionListItemSchema
  ): Promise<ArtifactTestData> {
    const artifact = await this.supertest
      .post(EXCEPTION_LIST_ITEM_URL)
      .set('kbn-xsrf', 'true')
      .send(createPayload)
      .then(this.getHttpResponseFailureHandler())
      .then((response) => response.body as ExceptionListItemSchema);

    const { item_id: itemId, namespace_type: namespaceType, list_id: listId } = artifact;

    this.log.info(`Created exception list item [${listId}]: ${itemId}`);

    const cleanup = async () => {
      const deleteResponse = await this.supertest
        .delete(`${EXCEPTION_LIST_ITEM_URL}?item_id=${itemId}&namespace_type=${namespaceType}`)
        .set('kbn-xsrf', 'true')
        .send()
        .then(this.getHttpResponseFailureHandler([404]));

      this.log.info(
        `Deleted exception list item [${listId}]: ${itemId} (${deleteResponse.status})`
      );
    };

    return {
      artifact,
      cleanup,
    };
  }

  async createTrustedApp(
    overrides: Partial<CreateExceptionListItemSchema> = {}
  ): Promise<ArtifactTestData> {
    await this.ensureListExists(TRUSTED_APPS_EXCEPTION_LIST_DEFINITION);
    const trustedApp = this.exceptionsGenerator.generateTrustedAppForCreate(overrides);

    return this.createExceptionItem(trustedApp);
  }

  async createEventFilter(
    overrides: Partial<CreateExceptionListItemSchema> = {}
  ): Promise<ArtifactTestData> {
    await this.ensureListExists(EVENT_FILTER_LIST_DEFINITION);
    const eventFilter = this.exceptionsGenerator.generateEventFilterForCreate(overrides);

    return this.createExceptionItem(eventFilter);
  }

  async createHostIsolationException(
    overrides: Partial<CreateExceptionListItemSchema> = {}
  ): Promise<ArtifactTestData> {
    await this.ensureListExists(HOST_ISOLATION_EXCEPTIONS_LIST_DEFINITION);
    const artifact = this.exceptionsGenerator.generateHostIsolationExceptionForCreate(overrides);

    return this.createExceptionItem(artifact);
  }

  async createBlocklist(
    overrides: Partial<CreateExceptionListItemSchema> = {}
  ): Promise<ArtifactTestData> {
    await this.ensureListExists(BLOCKLISTS_LIST_DEFINITION);
    const blocklist = this.exceptionsGenerator.generateBlocklistForCreate(overrides);

    return this.createExceptionItem(blocklist);
  }

  async createArtifact(
    listId: (typeof ENDPOINT_ARTIFACT_LIST_IDS)[number],
    overrides: Partial<CreateExceptionListItemSchema> = {}
  ): Promise<ArtifactTestData | undefined> {
    switch (listId) {
      case ENDPOINT_ARTIFACT_LISTS.trustedApps.id: {
        return this.createTrustedApp(overrides);
      }
      case ENDPOINT_ARTIFACT_LISTS.eventFilters.id: {
        return this.createEventFilter(overrides);
      }
      case ENDPOINT_ARTIFACT_LISTS.blocklists.id: {
        return this.createBlocklist(overrides);
      }
      case ENDPOINT_ARTIFACT_LISTS.hostIsolationExceptions.id: {
        return this.createHostIsolationException(overrides);
      }
    }
  }

  async getArtifactsFromUnifiedManifestSO(): Promise<
    Array<
      InternalUnifiedManifestSchemaResponseType['_source']['endpoint:unified-user-artifact-manifest']
    >
  > {
    const {
      hits: { hits: manifestResults },
    } = await this.esClient.search<InternalUnifiedManifestSchemaResponseType['_source']>({
      index: '.kibana*',
      query: {
        bool: { filter: [{ term: { type: ManifestConstants.UNIFIED_SAVED_OBJECT_TYPE } }] },
      },
    });

    return manifestResults.map(
      (result) => result._source!['endpoint:unified-user-artifact-manifest']
    );
  }
}
