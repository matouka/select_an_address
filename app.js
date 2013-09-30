(function() {
  return {
    customFieldRegExp: new RegExp(/custom_field_([0-9]+)/),
    events: {
      'ticket.save':'onTicketSave'
    },
    requests: {
      createTicket: function(data) {
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          type: 'POST',
          data: JSON.stringify(data),
          contentType: 'application/json'
        };
      }
    },

    onTicketSave: function() {
      return this.promise(function(done, fail){
        var self = this,
        attributes;

        if (this.shouldCreateTicket(done, fail)){
          try {
            attributes = this.serializeTicketAttributes();

            this.ajax('createTicket', attributes)
              .done(function(data){
                fail(this.I18n.t('notice.ticket_created', { id: data.ticket.id }));
                self.clearAttributes();
              })
              .fail(function(data){
                fail(data.responseText);
              });
          } catch(e) {
            console.log(e.stack);
            fail(e.message);
          }
        }
      });
    },

    shouldCreateTicket: function(done, fail){
      if (_.isEmpty(this.brandEmail())) {
        if (this.setting('force_selection_of_brand')) {
          fail(this.I18n.t('errors.brand'));
        } else {
          done();
        }
        return false;
      } else {
        return true;
      }
    },

    serializeTicketAttributes: function(){
      var ticket = this.ticket(),
      attributes = {
        subject: ticket.subject(),
        description: this.comment().text(),
        priority: ticket.priority(),
        status: ticket.status(),
        tags: ticket.tags(),
        type: ticket.type(),
        collaborators: _.map(ticket.collaborators(), function(cc){ return cc.email(); }),
        form_id: (ticket.form() && ticket.form().id()) || null,
        assignee_id: (ticket.assignee().user() && ticket.assignee().user().id()) || null,
        group_id: (ticket.assignee().group() && ticket.assignee().group().id()) || null,
        requester_id: (ticket.requester() && ticket.requester().id()) || null,
        recipient: this.brandEmail(),
        custom_fields: this.serializeCustomFields(),
        submitter_id: this.currentUser().id()
      };

      if (this._isEmpty(String(attributes.requester_id))){
        throw({ message: this.I18n.t('errors.requester') });
      }

      if (ticket.requester() &&
          this._isEmpty(ticket.requester().email()) &&
          this.setting('mandatory_requester_email')){
        throw({ message: this.I18n.t('errors.requester_email') });
      }

      return { ticket: attributes };
    },

    serializeCustomFields: function(){
      var fields = [];

      this.forEachCustomField(function(field){
        if (!this._isEmpty(field.value)){
          fields.push({
            id: field.id,
            value: field.value
          });
        }
      });

      return fields;
    },

    forEachCustomField: function(block){
      _.each(this._customFields(), function(field){
        var id = field.match(this.customFieldRegExp)[1];

        block.call(this, {
          label: field,
          id: id,
          value: this.ticket().customField(field)
        });
      }, this);
    },

    clearAttributes: function(){
      this.ticket().subject('');
      this.comment().text('');
      this.ticket().priority('-');
      this.ticket().type('ticket');
      this.ticket().requester({ email: ''});
      this.ticket().tags([]);

      this.forEachCustomField(function(field){
        this.ticket().customField(field.label, '');
      });
    },

    brandEmail: function(){
      return this._mapping()[this._brand()];
    },

    _customFields: _.memoize(function(){
      return _.filter(_.keys(this.containerContext().ticket), function(field){
        return field.match(this.customFieldRegExp);
      }, this);
    }),

    _brand: function(){
      return this.ticket().customField('custom_field_%@'.fmt(this.setting('brand_field_id')));
    },

    _isEmpty: function(field){
      return _.isUndefined(field) ||
        _.isNull(field) ||
        field === '-';
    },

    _mapping: _.memoize(function(){
      return JSON.parse(this.setting('mapping'));
    })
  };
}());