(function () {
    'use strict';

    angular
        .module('app.core')
        .service('productDataservice-bz', ProductDataservice);

    ProductDataservice.$inject = ['$q', '$http', 'breeze', 'entityManagerFactory', 'logger', 'model'];

    /* @ngInject */
    function ProductDataservice($q, $http, breeze, emFactory, logger, model) {
        /*jshint validthis: true */        
        var service = this;
        var manager = getEntityManager();
        var queriedProducts = false;

        this.categoryNullo  = categoryNullo;
        // this.categories  = see getLookups()
        this.createProduct  = createProduct;
        this.getProducts    = getProducts;
        this.getProductById = getProductById;
        // this.hasChanges
        this.name           = 'Breeze productDataservice';
        this.ready          = ready;
        this.rejectChanges  = rejectChanges;
        this.reset          = reset;    
        this.save           = save;
        this.supplierNullo  = supplierNullo;
        // this.suppliers: see getSuppliers()

        Object.defineProperty(this, 'hasChanges', 
            { get: manager.hasChanges.bind(manager) });


        ///////////////////////////
        function createProduct() {
            return manager.createEntity('Product');
        }


        function getProducts(forceRefresh) {
            var resource = 'Products';
            var query = breeze.EntityQuery.from(resource)
                .orderBy('productName');

            // if should get from cache and previously queried
            // query the cache instead of the remote server
            if (!forceRefresh && queriedProducts){
                query = query.using(breeze.FetchStrategy.FromLocalCache);
            }

            return manager
                .executeQuery(query)
                .then(success)
                .catch(failed(resource));

            function success(data){
               queriedProducts = true; // remember we queried it
               return data.results;             
            }
        
        }

        function getProductById(id, forceRemote) {
            return manager.fetchEntityByKey('Product', [id], !forceRemote)
            .then(success)
            .catch(failed('Product with id:' + id));

            function success(data) {
                return data.entity;
            }
        }

        /////// Helpers /////////

        function failed(resource){
            return function(error) {
                var msg = resource + ' query failed:\n' + error.message;
                logger.error(msg);
                return $q.reject(error); //pass error along
            };
        }

        function getEntityManager() {

            // No suppliers in the IdeaBlade sampleservice
            // redefine getSuppliers function to return nothing
            if (emFactory.isSampleService)  {
                getSuppliers = function() {
                    return $q.when([]); // return empty suppliers
                };
            } 

            return emFactory.manager;        
        } 

        function getLookups() {
            return breeze.EntityQuery.from('Lookups')
                .using(manager).execute()
                .then(success)
                .catch(failed('Lookups'));

            function success(data){
                var lups = data.results[0];
                service.categories = function() {return lups.categories.slice();};
                return lups;
            }
        }

        function getSuppliers() {
            return breeze.EntityQuery.from('Suppliers')
                .orderBy('companyName')
                .using(manager).execute()
                .then(success)
                .catch(failed('Suppliers'));

            function success(data){
                var suppliers = data.results;
                service.suppliers = function() {return suppliers.slice();};
                return suppliers;
            }
        }

        // returns a promise which resolves to this service after initialization
        function ready(){
            // Ready when we've loaded the lookups and the suppliers
            // Get the metadata first and extend it.
            var promise = manager.fetchMetadata()
                .then(function(){
                   model.extendMetadata(manager.metadataStore);
                   return $q.all([getLookups(), getSuppliers()]); 
                })
                .then(function(){
                    logger.info('Loaded lookups and suppliers');
                    return service;
                })
                .catch(failed('Ready'));

            // subsequent calls just get the promise
            service.ready = function(){return promise;}; 

            return promise;          
        }     

        function rejectChanges(){
            manager.rejectChanges();
        }

        function save(entity) {
            // save one or save all
            var entitiesToSave = entity ? [entity] : undefined; 

            manager.saveChanges(entitiesToSave).then(success).catch(fail);

            function success(saveResult){
                logger.success('Saved changes');
            }

            function fail(error){
                logger.error('Save failed: \n'+error.message);                
            }
        }


        var _categoryNullo;
        function categoryNullo(){
            return _categoryNullo || (
                _categoryNullo = manager.createEntity('Category', 
                {
                    categoryID: 0,
                    categoryName: '-- Select a category --'
                },
                breeze.EntityState.Unchanged)
            );
        }

        var _supplierNullo;
        function supplierNullo(){
            return _supplierNullo || (
                _supplierNullo = manager.createEntity('Supplier', 
                {
                    supplierID: 0,
                    companyName: '-- Select a supplier --'
                },
                breeze.EntityState.Unchanged)
            );
        }







        ///// RESET IS ADVANCED STUFF.  
        // Interesting for its use of a non-Breeze API call
        // Clear everything local and reload from server.
        function reset(){
            // wip.stop();
            // wip.clear();

            return resetNorthwind()
                .then(refreshProducts)
                .finally(function(){
                    //wip.resume();
                });

            function refreshProducts(){
                var prods = manager.getEntities('Product');
                prods.forEach(function(p){manager.detachEntity(p);}); 
                return getProducts(true)
                    .then(function(products){ 
                        logger.success('Products reset');
                        return products;
                    });           
            }
        }

        function resetNorthwind() {
            return $http.post(manager.dataService.serviceName + '/reset/?options=fullreset');
        }
    }
})();