import { createAction, createReducer, on, props, Store } from '@ngrx/store';
import { defaultEntityConfig, EntityConfig, EntityStoreConfig } from '../models/entity-store-config';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { EntityCrudService } from './entity-crud.service';
import { catchError, delay, filter, startWith, take } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';
import { EntityCollectionState, EntityState, EntityStoreState } from '../models/entity-state';
import { EntityStorePage } from '../models/entity-store-page';

export const SUB_STORE_KEY_SELECTED_ENTITY = 'selectedEntity';
export const SUB_STORE_KEY_ENTITIES        = 'entities';

export const ENTITY_STORE_STATUS_INITIAL    = 'initial';
export const ENTITY_STORE_STATUS_LOADING    = 'loading';
export const ENTITY_STORE_STATUS_LOADED     = 'loaded';
export const ENTITY_STORE_STATUS_SAVING     = 'saving';
export const ENTITY_STORE_STATUS_SAVED      = 'saved';
export const ENTITY_STORE_STATUS_DELETING   = 'deleting';
export const ENTITY_STORE_STATUS_DELETED    = 'deleted';
export const ENTITY_STORE_STATUS_ERROR      = 'error';

export class EntityStoreService<T> extends EntityCrudService<T> {

  entityConfig: EntityConfig;

  selectedEntity$: Observable<T>;
  selectedEntityState$: Observable<EntityState<T>>;
  selectedEntityStatus$: Observable<string>;
  selectedEntityIsBusy$: Observable<boolean>;
  selectedEntityError$: Observable<any>;

  entities$: Observable<T[]>;
  entityStates$: Observable<EntityState<T>[]>;
  collection$: Observable<EntityCollectionState<T>>;
  totalEntities$: Observable<number>;
  collectionIsBusy$: Observable<boolean>;
  collectionStatus$: Observable<string>;
  collectionError$: Observable<any>;

  initialState: EntityStoreState<T> = {
    selectedEntity: {
      status: ENTITY_STORE_STATUS_INITIAL,
      isBusy: false,
      entity: null,
      error: null
    },
    collection: {
      status: ENTITY_STORE_STATUS_INITIAL,
      isBusy: false,
      apiFilter: null,
      entityStates: [],
      totalEntities: 0,
      error: null
    }
  };

  actions: {
    setEntities?,
    getAll?,
    setEntitiesBusyIndication?,
    setEntitiesError?,

    setSelectedEntity?,
    getByKey?,
    save?,
    onAfterSave?,
    deleteByKey?,
    onAfterDeleteByKey?,
    setSelectedEntityBusyIndication?
    setSelectedEntityError?
  } = {};

  constructor(
    protected entityName: string,
    protected httpClient: HttpClient,
    protected entityStoreConfig: EntityStoreConfig,
    protected store: Store<any>
  ) {

    super(entityName, httpClient, entityStoreConfig);

    this.entityConfig = {
      ...defaultEntityConfig,
      entityName: entityName,
      ...entityStoreConfig.entities[entityName]
    };

    this.createActions();
    this.createReducer();
    this.createObservables();
  }

  private createActions() {

    this.actions.setEntities = createAction(`[EntityStore][${this.entityConfig.entityName}] setEntities`, props<{ entities: T[], totalEntities: number, completeStatus: string }>());
    this.actions.getAll = createAction(`[EntityStore][${this.entityConfig.entityName}] getAll`, props<{ apiFilter: any }>());
    this.actions.setEntitiesBusyIndication = createAction(`[EntityStore][${this.entityConfig.entityName}] setEntitiesBusyIndication`, props<{ isBusy: boolean, status: string }>());
    this.actions.setEntitiesError = createAction(`[EntityStore][${this.entityConfig.entityName}] setEntitiesError`, props<{ error: any }>());

    this.actions.setSelectedEntity = createAction(`[EntityStore][${this.entityConfig.entityName}] setSelectedEntity`, props<{ entity: T, completeStatus: string }>());
    this.actions.getByKey = createAction(`[EntityStore][${this.entityConfig.entityName}] getByKey`, props<{ key: any }>());
    this.actions.save = createAction(`[EntityStore][${this.entityConfig.entityName}] save`, props<{ entity: T }>());
    this.actions.onAfterSave = createAction(`[EntityStore][${this.entityConfig.entityName}] onAfterSave`, props<{ entity: T }>());
    this.actions.deleteByKey = createAction(`[EntityStore][${this.entityConfig.entityName}] deleteByKey`, props<{ key: any }>());
    this.actions.onAfterDeleteByKey = createAction(`[EntityStore][${this.entityConfig.entityName}] onAfterDeleteByKey`, props<{ key: any }>());
    this.actions.setSelectedEntityBusyIndication = createAction(`[EntityStore][${this.entityConfig.entityName}] setSelectedEntityBusyIndication`, props<{ isBusy: boolean, status: string, key?: any }>());
    this.actions.setSelectedEntityError = createAction(`[EntityStore][${this.entityConfig.entityName}] setSelectedEntityError`, props<{ error: any }>());

  }

  private createReducer() {

    // NB! We don't use @ngrx/effects, because RIGHT NOW there is no way to create effect dynamically and attach it to the app
    // (like store.addReducer() for example). If this functionality will be added to @ngrx - it's time to switch to effects from
    // dispatching an action after HTTP-request was done

    const entityStoreReducer = createReducer(
      this.initialState,
      on(this.actions.setEntities, this.onSetEntities.bind(this)),
      on(this.actions.getAll, this.onGetAll.bind(this)),
      on(this.actions.setEntitiesBusyIndication, this.onSetEntitiesBusyIndication.bind(this)),
      on(this.actions.setEntitiesError, this.onSetEntitiesError.bind(this)),

      on(this.actions.setSelectedEntity, this.onSetSelectedEntity.bind(this)),
      on(this.actions.getByKey, this.onGetByKey.bind(this)),
      on(this.actions.save, this.onSave.bind(this)),
      on(this.actions.onAfterSave, this.onAfterSave.bind(this)),
      on(this.actions.deleteByKey, this.onDeleteByKey.bind(this)),
      on(this.actions.onAfterDeleteByKey, this.onAfterDeleteByKey.bind(this)),
      on(this.actions.setSelectedEntityBusyIndication, this.onSetSelectedEntityBusyIndication.bind(this)),
      on(this.actions.setSelectedEntityError, this.onSetSelectedEntityError.bind(this))
    );

    this.store.addReducer(this.entityConfig.storeKey, entityStoreReducer);

  }

  private createObservables() {

    const storeKey = this.entityConfig.storeKey;

    this.selectedEntityState$ = this.store.select(appState => appState[storeKey].selectedEntity);
    this.selectedEntity$ = this.store.select(appState => appState[storeKey].selectedEntity.entity);
    this.selectedEntityIsBusy$ = this.store.select(appState => appState[storeKey].selectedEntity.isBusy);
    this.selectedEntityStatus$ = this.store.select(appState => appState[storeKey].selectedEntity.status);
    this.selectedEntityError$ = this.store.select(appState => appState[storeKey].selectedEntity.error);

    this.entities$ = this.store.select(appState => appState[storeKey].collection.entityStates.map(entityState => entityState.entity));
    this.entityStates$ = this.store.select(appState => appState[storeKey].collection.entityStates);
    this.collection$ = this.store.select(appState => appState[storeKey].collection);
    this.totalEntities$ = this.store.select(appState => appState[storeKey].collection.totalEntities);
    this.collectionIsBusy$ = this.store.select(appState => appState[storeKey].collection.isBusy);
    this.collectionStatus$ = this.store.select(appState => appState[storeKey].collection.status);
    this.collectionError$ = this.store.select(appState => appState[storeKey].collection.error);

  }

  // =================================================================================================================
  // === Actions dispatchers =========================================================================================
  // =================================================================================================================

  getAll(apiFilter?: any) {
    this.store.dispatch(this.actions.getAll({apiFilter: apiFilter}));
  }

  getByKey(key: any) {
    this.store.dispatch(this.actions.getByKey({ key }));
  }

  save(entity: T) {
    this.store.dispatch(this.actions.save({ entity }));
  }

  deleteByKey(key: any) {
    this.store.dispatch(this.actions.deleteByKey({ key }));
  }

  // =================================================================================================================
  // === API call triggering actions =================================================================================
  // =================================================================================================================

  private onGetAll(state, actionProps: { apiFilter: any, type: string }) {

    this.constructApiCall$(
      SUB_STORE_KEY_ENTITIES,
      this.getAll$(actionProps.apiFilter),
      ENTITY_STORE_STATUS_LOADING
    )
    .subscribe((response: EntityStorePage<T>) => {
      this.store.dispatch(this.actions.setEntities({
        entities: response.entities,
        totalEntities: response.totalEntities,
        completeStatus: ENTITY_STORE_STATUS_LOADED
      }));
    });

    // We are setting apiFilter right away, but the status / isBusy indication will be
    // triggered in constructApiCall$ depending on delay set in entityStoreConfig.busyIndicationDelay
    return {
      ...state,
      collection: {
        ...state.collection,
        apiFilter: actionProps.apiFilter
      }
    };

  }

  private onGetByKey(state, actionProps: { key: any }) {

    this.constructApiCall$(
        SUB_STORE_KEY_SELECTED_ENTITY,
        this.getByKey$(actionProps.key),
        ENTITY_STORE_STATUS_LOADING,
        actionProps.key
      )
      .subscribe(entity => {
        this.store.dispatch(this.actions.setSelectedEntity({
          entity,
          completeStatus: ENTITY_STORE_STATUS_LOADED
        }));
      });

    return { ...state };

  }

  private onSave(state, actionProps: { entity: T }) {

    const key = (actionProps.entity[this.entityConfig.keyProperty]) ? actionProps.entity[this.entityConfig.keyProperty] : null;

    this.constructApiCall$(
        SUB_STORE_KEY_SELECTED_ENTITY,
        this.save$(actionProps.entity),
        ENTITY_STORE_STATUS_SAVING,
        key
      )
      .subscribe((entity: T) => {
        this.store.dispatch(this.actions.onAfterSave({ entity }));
      });

    return { ...state };
  }

  private onDeleteByKey(state, actionProps: { key: any }) {

    this.constructApiCall$(
        SUB_STORE_KEY_SELECTED_ENTITY,
        this.deleteByKey$(actionProps.key),
        ENTITY_STORE_STATUS_DELETING,
        actionProps.key
      )
      .subscribe((entity: T) => {
        this.store.dispatch(this.actions.onAfterDeleteByKey({ entity }));
      });

    return { ...state };
  }

  // ==================================================================================================================
  // === API response processing actions ==============================================================================
  // ==================================================================================================================

  private onSetEntities(state, actionProps: { entities: T[], totalEntities: number, completeStatus: string }) {

    return {
      ...state,
      collection: {
        ...state.collection,
        isBusy: false,
        status: actionProps.completeStatus,
        entityStates: actionProps.entities.map(entity => {
          return {
            isBusy: false,
            status: actionProps.completeStatus,
            entity
          } as EntityState<T>;
        }),
        totalEntities: actionProps.totalEntities
      }
    };

  }

  private onSetEntitiesError(state, actionProps: {error: any}) {

    return {
      ...state,
      collection: {
        ...state.collection,
        isBusy: false,
        status: ENTITY_STORE_STATUS_ERROR,
        error: actionProps.error
      }
    };

  }

  private onSetSelectedEntity(state, actionProps: { entity: T, completeStatus: string }) {

    const updatedEntityState = {
      ...state.selectedEntity,
      isBusy: false,
      status: actionProps.completeStatus,
      entity: actionProps.entity,
      error: null
    };

    return {
      ...state,
      selectedEntity: updatedEntityState,
      collection: this.updateEntityStateInCollection(state.collection, updatedEntityState)
    };

  }

  private onAfterSave(state, actionProps: { entity: T }) {

    const keyProperty = this.entityConfig.keyProperty;

    const updatedState = { ...state };

    const updatedEntityState = {
      isBusy: false,
      status: ENTITY_STORE_STATUS_SAVED,
      entity: actionProps.entity,
      error: null
    };

    if (!state.selectedEntity.entity || state.selectedEntity.entity[keyProperty] === actionProps.entity[keyProperty]) {
      updatedState.selectedEntity = updatedEntityState;
    }

    updatedState.collection = this.updateEntityStateInCollection(state.collection, updatedEntityState);

    return updatedState;
  }

  private onAfterDeleteByKey(state, actionProps: { entity: T }) {

    const keyProperty = this.entityConfig.keyProperty;

    const updatedState = { ...state };

    const updatedEntityState = {
      ...state.selectedEntity,
      entity: null,
      isBusy: false,
      status: ENTITY_STORE_STATUS_DELETED,
      error: null
    };

    if (state.selectedEntity.entity && state.selectedEntity.entity[keyProperty] === actionProps.entity[keyProperty]) {
      updatedState.selectedEntity = updatedEntityState;
    }

    // Removing deleted entity from state.entityStates, if it's found there
    const existingEntityIndex = updatedState.collection.entityStates.findIndex(entityState => entityState.entity[keyProperty] === actionProps.entity[keyProperty]);
    if (existingEntityIndex !== -1) {
      updatedState.collection.entityStates.splice(existingEntityIndex, 1);
    }

    return updatedState;
  }

  private onSetSelectedEntityError(state, actionProps: {error: any}) {

    return {
      ...state,
      selectedEntity: {
        ...state.selectedEntity,
        isBusy: false,
        status: ENTITY_STORE_STATUS_ERROR,
        error: actionProps.error
      }
    };

  }

  private onSetEntitiesBusyIndication(state, actionProps: { isBusy: boolean, status: string }) {

    return {
      ...state,
      entityStates: {
        ...state.entityStates,
        isBusy: actionProps.isBusy,
        status: actionProps.status
      }
    };

  }

  private onSetSelectedEntityBusyIndication(state, actionProps: { isBusy: boolean, status: string, key: any }) {

    const updatedEntityState = {
      ...state.selectedEntity,
      isBusy: actionProps.isBusy,
      status: actionProps.status,
      error: null
    };

    return {
      ...state,
      selectedEntity: updatedEntityState,
      collection: this.updateEntityStateInCollection(state.collection, updatedEntityState)
    };

  }

  private updateEntityStateInCollection(collection: EntityCollectionState<T>, updatedEntityState: EntityState<T>): EntityCollectionState<T> {

    const keyProperty = this.entityConfig.keyProperty;

    if (updatedEntityState.entity && updatedEntityState.entity[keyProperty] && collection && collection.entityStates) {

      const existingEntityIndex = collection.entityStates.findIndex(entityState => entityState.entity[keyProperty] === updatedEntityState.entity[keyProperty]);

      if (existingEntityIndex !== -1) {
        const updatedCollection = { ...collection };
        collection.entityStates[existingEntityIndex] = updatedEntityState;
        return updatedCollection;
      }
    }

    return collection;
  }

  private constructApiCall$(
    subStoreKey: string,
    apiCall$: Observable<any>,
    busyStatus: string,
    entityKey?: any
  ) {

    let setContentAction;
    let setBusyIndicationAction;
    let setErrorAction;

    switch (subStoreKey) {
      case SUB_STORE_KEY_ENTITIES:
        setContentAction        = this.actions.setEntities;
        setBusyIndicationAction = this.actions.setEntitiesBusyIndication;
        setErrorAction          = this.actions.setEntitiesError;
        break;
      case SUB_STORE_KEY_SELECTED_ENTITY:
        setContentAction        = this.actions.setSelectedEntity;
        setBusyIndicationAction = this.actions.setSelectedEntityBusyIndication;
        setErrorAction          = this.actions.setSelectedEntityError;
        break;
    }

    return combineLatest(
      of(true).pipe(
        delay(this.entityStoreConfig.busyIndicationDelay),
        startWith(false)
      ),
      apiCall$.pipe(startWith(null)),
      (busyIndicationDelayStatus, responseData) => {

        if (responseData) {
          return responseData;
        }

        // If API-query takes longer than "busyIndicationDelay" - fire up "show the busy indicator" event
        if (busyIndicationDelayStatus && !responseData) {
          this.store.dispatch(setBusyIndicationAction({ isBusy: true, status: busyStatus, key: entityKey }));
        }

        return null;

      })
      .pipe(
        catchError(error => {
          this.store.dispatch(setErrorAction({ error }));
          return null;
        }),
        filter(responseData => !!responseData),  // We pass only valid data with response (we don't care about indicationDelay)
        take(1)                                     // We pass only 1 valid data response (2nd will be triggered with { busyIndicationStatus: true, responseData: [] }, we don't need it
      );

  }


}