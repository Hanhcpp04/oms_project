
    create table audit_events (
        response_status integer not null,
        actor_user_id bigint,
        id bigint not null auto_increment,
        occurred_at datetime(6) not null,
        http_method varchar(10) not null,
        remote_address varchar(64),
        request_id varchar(100),
        actor_email varchar(190),
        request_path varchar(500) not null,
        primary key (id)
    ) engine=InnoDB;

    create table form_template_field_options (
        is_active bit not null,
        sort_order integer not null,
        created_at datetime(6) not null,
        field_id bigint not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        label varchar(150) not null,
        value varchar(150) not null,
        primary key (id)
    ) engine=InnoDB;

    create table form_template_fields (
        is_active bit not null,
        is_required bit not null,
        show_in_order_detail bit not null,
        show_in_order_list bit not null,
        sort_order integer not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        template_id bigint not null,
        updated_at datetime(6),
        field_type varchar(30) not null,
        semantic_key varchar(50),
        field_key varchar(100) not null,
        label varchar(150) not null,
        default_value varchar(255),
        helper_text varchar(255),
        placeholder varchar(255),
        validation_rules_json JSON,
        primary key (id)
    ) engine=InnoDB;

    create table form_templates (
        is_public bit not null,
        version_no integer not null,
        created_at datetime(6) not null,
        created_by_user_id bigint,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        name varchar(150) not null,
        public_slug varchar(180),
        description varchar(255),
        category enum('general','rent','sell'),
        form_type enum('INTERNAL','ORDER_CAPTURE','PUBLIC') not null,
        status enum('ARCHIVED','DRAFT','PUBLISHED') not null,
        primary key (id)
    ) engine=InnoDB;

    create table messenger_conversations (
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        last_order_marker_time datetime(6),
        updated_at datetime(6),
        page_id varchar(100) not null,
        sender_id varchar(100) not null,
        conversation_key varchar(255) not null,
        platform enum('FACEBOOK') not null,
        status enum('CLOSED','OPEN') not null,
        primary key (id)
    ) engine=InnoDB;

    create table messenger_messages (
        is_echo bit not null,
        conversation_id bigint not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        message_time datetime(6) not null,
        updated_at datetime(6),
        sender_id varchar(100) not null,
        mid varchar(255),
        raw_payload LONGTEXT,
        sender_type enum('CUSTOMER','STAFF','SYSTEM') not null,
        text TEXT,
        primary key (id)
    ) engine=InnoDB;

    create table messenger_order_draft_items (
        deposit decimal(15,2),
        price decimal(15,2),
        quantity integer not null,
        rental_days integer,
        created_at datetime(6) not null,
        draft_id bigint not null,
        id bigint not null auto_increment,
        product_id bigint,
        updated_at datetime(6),
        variant_id bigint,
        product_code varchar(100),
        sku varchar(100),
        variant varchar(150),
        product_name varchar(255) not null,
        primary key (id)
    ) engine=InnoDB;

    create table messenger_order_drafts (
        confidence float(53),
        delivery_date date,
        deposit_amount decimal(15,2),
        price decimal(15,2),
        quantity integer,
        rent_from date,
        rent_to date,
        rental_days integer,
        shipping_fee decimal(12,0),
        subtotal decimal(15,2),
        total_amount decimal(15,2),
        confirmed_at datetime(6),
        conversation_id bigint not null,
        converted_order_id bigint,
        created_at datetime(6) not null,
        expires_at datetime(6),
        id bigint not null auto_increment,
        shipping_method_id bigint,
        shop_id bigint,
        updated_at datetime(6),
        draft_code varchar(30),
        phone varchar(30),
        product_size varchar(50),
        color varchar(80),
        customer_psid varchar(100),
        page_id varchar(100),
        product_code varchar(100),
        shipping_method varchar(100),
        customer_name varchar(150),
        missing_fields TEXT,
        product_name varchar(255),
        source_message_mid varchar(255),
        address TEXT,
        ai_parsed_json LONGTEXT,
        confirm_message TEXT,
        note TEXT,
        order_type enum('RENT','SELL'),
        raw_seller_message TEXT,
        status enum('CANCELLED','CONFIRMED','CONVERTED_TO_ORDER','DRAFT','EXPIRED','NEED_MORE_INFO','PENDING_CUSTOMER_CONFIRMATION','WAITING_CONFIRM') not null,
        primary key (id)
    ) engine=InnoDB;

    create table messenger_orders (
        price decimal(15,2),
        quantity integer,
        conversation_id bigint not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        order_draft_id bigint not null,
        updated_at datetime(6),
        phone varchar(30),
        product_size varchar(50),
        color varchar(80),
        product_code varchar(100),
        customer_name varchar(150),
        product_name varchar(255),
        address TEXT,
        note TEXT,
        status enum('CANCELLED','COMPLETED','NEW','PROCESSING') not null,
        primary key (id)
    ) engine=InnoDB;

    create table messenger_outbound_system_messages (
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        page_id varchar(100) not null,
        recipient_id varchar(100) not null,
        message_id varchar(255) not null,
        text TEXT,
        primary key (id)
    ) engine=InnoDB;

    create table messenger_pages (
        enabled bit not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        page_id varchar(100) not null,
        page_name varchar(255),
        page_access_token TEXT,
        primary key (id)
    ) engine=InnoDB;

    create table notifications (
        created_at datetime(6) not null,
        entity_id bigint,
        id bigint not null auto_increment,
        read_at datetime(6),
        recipient_user_id bigint,
        shop_id bigint not null,
        updated_at datetime(6),
        entity_type varchar(40),
        title varchar(150) not null,
        message varchar(500) not null,
        link_url varchar(255),
        payload_json TEXT,
        severity enum ('ERROR','INFO','SUCCESS','WARNING') not null,
        type enum ('ORDER_AUTO_CANCELLED_PAYMENT_TIMEOUT','ORDER_CREATED_MESSENGER','ORDER_CREATED_PUBLIC_FORM','ORDER_DEPOSITED','ORDER_PAID','PAYMENT_TIMEOUT_REMINDER') not null,
        primary key (id)
    ) engine=InnoDB;

    create table oauth_accounts (
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        last_login_at datetime(6),
        linked_at datetime(6) not null,
        updated_at datetime(6),
        user_id bigint not null,
        provider varchar(30) not null,
        provider_email varchar(150),
        provider_user_id varchar(150) not null,
        provider_avatar_url varchar(500),
        primary key (id)
    ) engine=InnoDB;

    create table order_custom_field_values (
        show_in_detail_snapshot bit,
        show_in_list_snapshot bit,
        sort_order_snapshot integer,
        created_at datetime(6),
        field_id bigint,
        id bigint not null auto_increment,
        order_id bigint not null,
        form_type_snapshot varchar(30),
        field_key_snapshot varchar(100) not null,
        label_snapshot varchar(150) not null,
        value_json JSON,
        primary key (id)
    ) engine=InnoDB;

    create table order_form_configs (
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        form_type enum('RENT','SELL','SELL_RENT') not null,
        primary key (id)
    ) engine=InnoDB;

    create table order_form_custom_fields (
        is_active bit not null,
        is_required bit not null,
        show_in_order_detail bit not null,
        show_in_order_list bit not null,
        sort_order integer not null,
        config_id bigint not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        field_type varchar(20) not null,
        field_key varchar(100) not null,
        label varchar(150) not null,
        helper_text varchar(255),
        placeholder varchar(255),
        validation_rules_json JSON,
        primary key (id)
    ) engine=InnoDB;

    create table order_form_field_options (
        is_active bit not null,
        sort_order integer not null,
        created_at datetime(6) not null,
        field_id bigint not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        label varchar(150) not null,
        value varchar(150) not null,
        primary key (id)
    ) engine=InnoDB;

    create table order_items (
        line_total decimal(15,2),
        quantity integer,
        unit_price decimal(15,2),
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        order_id bigint not null,
        product_id bigint,
        updated_at datetime(6),
        variant_id bigint,
        variant_color_snapshot varchar(50),
        variant_size_snapshot varchar(50),
        category_name_snapshot varchar(100),
        sku_snapshot varchar(100),
        product_image_snapshot varchar(500),
        custom_attributes_snapshot JSON,
        product_name_snapshot varchar(255),
        primary key (id)
    ) engine=InnoDB;

    create table order_status_logs (
        changed_by bigint,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        order_id bigint not null,
        updated_at datetime(6),
        from_status varchar(20),
        to_status varchar(20) not null,
        note TEXT,
        primary key (id)
    ) engine=InnoDB;

    create table orders (
        deposit_amount decimal(15,2),
        inventory_committed bit not null,
        payment_reminder_sent bit not null,
        rent_from date,
        rent_to date,
        shipping_fee decimal(12,0),
        total_amount decimal(15,2),
        created_at datetime(6) not null,
        created_by_id bigint,
        id bigint not null auto_increment,
        messenger_conversation_id bigint,
        messenger_draft_id bigint,
        shipping_method_id bigint,
        shop_id bigint not null,
        source_channel_id bigint,
        updated_at datetime(6),
        customer_phone varchar(20),
        order_code varchar(20),
        source_channel varchar(50),
        customer_name varchar(100),
        messenger_customer_psid varchar(100),
        messenger_page_id varchar(100),
        shipping_method varchar(100),
        custom_fields_json JSON,
        customer_address TEXT,
        customer_note TEXT,
        order_type enum('RENT','SELL') not null,
        payment_method enum('BANK_TRANSFER','COD','VNPAY'),
        payment_status enum('DEPOSITED','PAID','UNPAID'),
        source_method enum('AI_PARSE','MANUAL','MESSENGER','PUBLIC_FORM'),
        status enum('CANCELLED','CONFIRMED','DEPOSITED','DONE','NEW','OVERDUE','PACKING','PAID','PENDING','RENTING','RETURNED','SHIPPED') not null,
        primary key (id)
    ) engine=InnoDB;

    create table payments (
        amount decimal(15,0) not null,
        cancelled_at datetime(6),
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        order_id bigint not null,
        paid_at datetime(6),
        provider_order_code bigint,
        updated_at datetime(6),
        currency varchar(10) not null,
        provider_status varchar(30),
        provider_payment_link_id varchar(100),
        provider_reference varchar(100),
        failure_reason varchar(500),
        checkout_url varchar(1024),
        qr_image_url varchar(1024),
        description varchar(255),
        qr_code TEXT,
        webhook_payload_json TEXT,
        method enum ('BANK_TRANSFER') not null,
        provider enum ('PAYOS') not null,
        purpose enum ('ORDER_FULL','RENTAL_DEPOSIT') not null,
        status enum ('CANCELLED','EXPIRED','FAILED','PAID','PENDING') not null,
        primary key (id)
    ) engine=InnoDB;

    create table permissions (
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        category varchar(50) not null,
        code varchar(50) not null,
        name varchar(100) not null,
        description varchar(255),
        primary key (id)
    ) engine=InnoDB;

    create table product_custom_attribute_values (
        created_at datetime(6) not null,
        field_id bigint,
        id bigint not null auto_increment,
        product_id bigint not null,
        updated_at datetime(6),
        form_type_snapshot varchar(30),
        field_key_snapshot varchar(100),
        label_snapshot varchar(150),
        value_json JSON,
        primary key (id)
    ) engine=InnoDB;

    create table product_form_configs (
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        form_type enum('RENT','SELL','SELL_RENT') not null,
        primary key (id)
    ) engine=InnoDB;

    create table product_form_custom_fields (
        is_enabled bit not null,
        is_required bit not null,
        sort_order integer not null,
        config_id bigint not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        field_type varchar(20) not null,
        field_key varchar(100) not null,
        label varchar(150) not null,
        helper_text varchar(255),
        placeholder varchar(255),
        validation_rules_json JSON,
        primary key (id)
    ) engine=InnoDB;

    create table product_form_field_options (
        is_active bit not null,
        sort_order integer not null,
        created_at datetime(6) not null,
        field_id bigint not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        label varchar(150) not null,
        value varchar(150) not null,
        primary key (id)
    ) engine=InnoDB;

    create table product_images (
        sort_order integer,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        product_id bigint not null,
        updated_at datetime(6),
        alt_text varchar(200),
        url varchar(500) not null,
        primary key (id)
    ) engine=InnoDB;

    create table product_qr_codes (
        amount decimal(15,2) not null,
        created_at datetime(6) not null,
        created_by bigint not null,
        id bigint not null auto_increment,
        product_id bigint not null,
        updated_at datetime(6),
        product_name_at_time varchar(200),
        qr_url varchar(1000) not null,
        note varchar(255),
        primary key (id)
    ) engine=InnoDB;

    create table product_variants (
        deposit_amount decimal(15,2),
        is_active bit not null,
        price_rent_per_day decimal(15,2),
        price_sell decimal(15,2),
        stock_qty integer not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        product_id bigint not null,
        updated_at datetime(6),
        color varchar(50),
        size varchar(50),
        sku varchar(100),
        primary key (id)
    ) engine=InnoDB;

    create table products (
        is_active bit not null,
        category_id bigint,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        name varchar(200) not null,
        slug varchar(200),
        description TEXT,
        product_type enum('RENT','SELL','SELL_RENT') not null,
        primary key (id)
    ) engine=InnoDB;

    create table refresh_tokens (
        created_at datetime(6) not null,
        expires_at datetime(6) not null,
        id bigint not null auto_increment,
        revoked_at datetime(6),
        updated_at datetime(6),
        user_id bigint not null,
        token_hash varchar(128) not null,
        primary key (id)
    ) engine=InnoDB;

    create table rental_availability (
        end_date date not null,
        is_active bit,
        start_date date not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        order_id bigint,
        updated_at datetime(6),
        variant_id bigint not null,
        reason varchar(200),
        block_type enum ('CONFIRMED','MANUAL') not null,
        primary key (id)
    ) engine=InnoDB;

    create table shop_addresses (
        is_default bit not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        district varchar(100),
        label varchar(100) not null,
        province varchar(100),
        ward varchar(100),
        address_line varchar(255) not null,
        primary key (id)
    ) engine=InnoDB;

    create table shop_categories (
        is_active bit not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        name varchar(120) not null,
        slug varchar(120) not null,
        primary key (id)
    ) engine=InnoDB;

    create table shop_onboarding_states (
        is_completed bit not null,
        completed_at datetime(6),
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        current_step varchar(50) not null,
        primary key (id)
    ) engine=InnoDB;

    create table shop_order_sources (
        is_active bit not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        name varchar(100) not null,
        primary key (id)
    ) engine=InnoDB;

    create table shop_payment_configs (
        bank_transfer_enabled bit not null,
        cod_enabled bit not null,
        vnpay_enabled bit not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        bank_code varchar(20),
        bank_account_number varchar(50),
        vnpay_tmn_code varchar(50),
        bank_name varchar(100),
        bank_account_name varchar(150),
        vnpay_hash_secret varchar(255),
        primary key (id)
    ) engine=InnoDB;

    create table shop_shipping_methods (
        default_fee decimal(12,0),
        is_active bit not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        name varchar(100) not null,
        fee_policy enum('CUSTOMER_PAYS_SHIPPER','FIXED_FEE','FREESHIP') not null,
        primary key (id)
    ) engine=InnoDB;

    create table shops (
        auto_accept_orders bit not null,
        enable_rent bit not null,
        enable_sell bit not null,
        is_deleted bit not null,
        maintenance_mode bit not null,
        notifications_enabled bit not null,
        rental_identity_verification_enabled bit not null,
        show_inventory_on_storefront bit not null,
        token_version integer not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        updated_at datetime(6),
        business_mode varchar(20),
        phone varchar(20),
        support_phone varchar(30),
        slug varchar(50),
        name varchar(100) not null,
        email varchar(150),
        support_email varchar(150),
        logo_url varchar(255),
        status enum('ACTIVE','PENDING','SUSPENDED') not null,
        primary key (id)
    ) engine=InnoDB;

    create table staff_permissions (
        created_at datetime(6) not null,
        granted_by bigint not null,
        id bigint not null auto_increment,
        permission_id bigint not null,
        updated_at datetime(6),
        user_id bigint not null,
        primary key (id)
    ) engine=InnoDB;

    create table users (
        force_change_password bit not null,
        is_active bit not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        last_login datetime(6),
        shop_id bigint,
        updated_at datetime(6),
        phone varchar(20),
        username varchar(50),
        full_name varchar(100) not null,
        email varchar(150) not null,
        password varchar(255) not null,
        role enum('ADMIN','OWNER','STAFF') not null,
        primary key (id)
    ) engine=InnoDB;

    create table work_shift_staff (
        shift_id bigint not null,
        staff_id bigint not null,
        primary key (shift_id, staff_id)
    ) engine=InnoDB;

    create table work_shifts (
        end_time time(6) not null,
        shift_date date not null,
        start_time time(6) not null,
        created_at datetime(6) not null,
        id bigint not null auto_increment,
        shop_id bigint not null,
        updated_at datetime(6),
        name varchar(100),
        primary key (id)
    ) engine=InnoDB;

    create index idx_audit_event_occurred_at
       on audit_events (occurred_at);

    create index idx_audit_event_actor
       on audit_events (actor_user_id, occurred_at);

    create index idx_messenger_conversation_updated_at
       on messenger_conversations (updated_at);

    alter table messenger_conversations
       add constraint idx_messenger_conversation_key unique (conversation_key);

    create index idx_messenger_message_conversation_time
       on messenger_messages (conversation_id, message_time);

    create index idx_messenger_message_sender_id
       on messenger_messages (sender_id);

    alter table messenger_messages
       add constraint ux_messenger_message_mid unique (mid);

    create index idx_messenger_order_draft_item_draft_id
       on messenger_order_draft_items (draft_id);

    create index idx_messenger_order_draft_conversation_status
       on messenger_order_drafts (conversation_id, status);

    create index idx_messenger_order_draft_page_customer_status
       on messenger_order_drafts (page_id, customer_psid, status);

    create index idx_messenger_order_draft_created_at
       on messenger_order_drafts (created_at);

    alter table messenger_order_drafts
       add constraint ux_messenger_order_draft_code unique (draft_code);

    alter table messenger_order_drafts
       add constraint ux_messenger_order_draft_source_mid unique (source_message_mid);

    alter table messenger_order_drafts
       add constraint UKsepoqc4ohj94fowol2rbw6u4o unique (converted_order_id);

    create index idx_messenger_order_conversation_id
       on messenger_orders (conversation_id);

    create index idx_messenger_order_created_at
       on messenger_orders (created_at);

    alter table messenger_orders
       add constraint idx_messenger_order_draft_id unique (order_draft_id);

    create index idx_messenger_outbound_system_page_recipient
       on messenger_outbound_system_messages (page_id, recipient_id);

    alter table messenger_outbound_system_messages
       add constraint ux_messenger_outbound_system_mid unique (message_id);

    create index idx_messenger_page_shop_id
       on messenger_pages (shop_id);

    alter table messenger_pages
       add constraint ux_messenger_page_id unique (page_id);

    create index idx_notifications_shop_created
       on notifications (shop_id, created_at);

    create index idx_notifications_shop_read
       on notifications (shop_id, read_at);

    create index idx_notifications_entity
       on notifications (entity_type, entity_id);

    alter table order_form_configs
       add constraint UKt1fg7s5f4djwaifcb1x93s31 unique (shop_id, form_type);

    alter table orders
       add constraint UKdhk2umg8ijjkg4njg6891trit unique (order_code);

    create index idx_payments_order_id
       on payments (order_id);

    create index idx_payments_provider_order_code
       on payments (provider_order_code);

    create index idx_payments_provider_payment_link_id
       on payments (provider_payment_link_id);

    alter table payments
       add constraint uk_payments_provider_order_code unique (provider, provider_order_code);

    alter table payments
       add constraint uk_payments_provider_link_id unique (provider, provider_payment_link_id);

    alter table permissions
       add constraint UK7lcb6glmvwlro3p2w2cewxtvd unique (code);

    alter table product_form_configs
       add constraint UKpuekdscrnp406p5qnalebutpr unique (shop_id, form_type);

    alter table shop_onboarding_states
       add constraint UKmw44t9ns9omsfnyevuj8eofkl unique (shop_id);

    alter table shop_payment_configs
       add constraint UK8jrp0nrxqethm4ucjs8j6ea4o unique (shop_id);

    alter table shops
       add constraint UK1bphyyyptl7w9fp69a04krtfr unique (slug);

    alter table staff_permissions
       add constraint UKtcph3vg8kslqy11wtr4jj6wy7 unique (user_id, permission_id);

    alter table users
       add constraint UKr43af9ap4edm43mmtq01oddj6 unique (username);

    alter table users
       add constraint UK6dotkott2kjsp8vw4d0m25fb7 unique (email);

    alter table form_template_field_options
       add constraint FKgilq98esawurmff5j2tr60wjc
       foreign key (field_id)
       references form_template_fields (id);

    alter table form_template_fields
       add constraint FKgi0tssgoc7pdt8mwu7ue11nte
       foreign key (template_id)
       references form_templates (id);

    alter table form_templates
       add constraint FKrmg4n0s1ksoolhbathfgscgb0
       foreign key (shop_id)
       references shops (id);

    alter table messenger_messages
       add constraint FKmo6lrhp1kwp9j9ahgbkwmnj5l
       foreign key (conversation_id)
       references messenger_conversations (id);

    alter table messenger_order_draft_items
       add constraint FKe7cu83rx72vxw4b6wgi3haf07
       foreign key (draft_id)
       references messenger_order_drafts (id);

    alter table messenger_order_draft_items
       add constraint FKarlo7mvljgiiadsehusbej00d
       foreign key (product_id)
       references products (id);

    alter table messenger_order_draft_items
       add constraint FKk8q461n8r4k7p0oq1uu3a4v7o
       foreign key (variant_id)
       references product_variants (id);

    alter table messenger_order_drafts
       add constraint FK9pkt8s67f0o88h0jgli9alxsd
       foreign key (conversation_id)
       references messenger_conversations (id);

    alter table messenger_order_drafts
       add constraint FK3m3a52onj1ifl7qvauibltu46
       foreign key (converted_order_id)
       references orders (id);

    alter table messenger_order_drafts
       add constraint FKh0cgrrnaw4lt3fjlr1i7vmg96
       foreign key (shop_id)
       references shops (id);

    alter table messenger_orders
       add constraint FKpf9t2tw14p66m5vthmji8lrta
       foreign key (conversation_id)
       references messenger_conversations (id);

    alter table messenger_orders
       add constraint FKhipb1d1lf2jfq43o9rcwbs7py
       foreign key (order_draft_id)
       references messenger_order_drafts (id);

    alter table messenger_pages
       add constraint FK79p8moc2or5fl5hdwsudyn4q5
       foreign key (shop_id)
       references shops (id);

    alter table notifications
       add constraint FKt8ievafor22iuvg5sd4p7lhbk
       foreign key (recipient_user_id)
       references users (id);

    alter table notifications
       add constraint FK5v9l9b0k0o6g9hxo9g748ifb3
       foreign key (shop_id)
       references shops (id);

    alter table oauth_accounts
       add constraint FKn6j2b3ur1fcj3vkodrmqtdxmi
       foreign key (user_id)
       references users (id);

    alter table order_custom_field_values
       add constraint FKfdjd7kb3nid3xseumvg5b8jsf
       foreign key (order_id)
       references orders (id);

    alter table order_form_configs
       add constraint FKajrs8elgy00mqsiy3ya8psnh
       foreign key (shop_id)
       references shops (id);

    alter table order_form_custom_fields
       add constraint FK_ORDER_FIELD_CONFIG
       foreign key (config_id)
       references order_form_configs (id);

    alter table order_form_field_options
       add constraint FK_ORDER_OPTION_FIELD
       foreign key (field_id)
       references order_form_custom_fields (id);

    alter table order_items
       add constraint FKbioxgbv59vetrxe0ejfubep1w
       foreign key (order_id)
       references orders (id);

    alter table order_items
       add constraint FKocimc7dtr037rh4ls4l95nlfi
       foreign key (product_id)
       references products (id);

    alter table order_items
       add constraint FKemq71edpbn9wsxnxncfn1algp
       foreign key (variant_id)
       references product_variants (id);

    alter table order_status_logs
       add constraint FKfs3dssq3pkgrwr97m6kr8xvl
       foreign key (changed_by)
       references users (id);

    alter table order_status_logs
       add constraint FKpoehv8fptppd81oysnw7l44by
       foreign key (order_id)
       references orders (id);

    alter table orders
       add constraint FK2fw0iiauv5pgvxmw31vf38dqt
       foreign key (created_by_id)
       references users (id);

    alter table orders
       add constraint FK21gttsw5evi5bbsvleui69d7r
       foreign key (shop_id)
       references shops (id);

    alter table payments
       add constraint FK81gagumt0r8y3rmudcgpbk42l
       foreign key (order_id)
       references orders (id);

    alter table product_custom_attribute_values
       add constraint FKmweomeo5530icf46tbuvtx5rb
       foreign key (field_id)
       references product_form_custom_fields (id);

    alter table product_custom_attribute_values
       add constraint FK362h6cbibocy3y8qts75updgv
       foreign key (product_id)
       references products (id);

    alter table product_form_configs
       add constraint FK3579fcp16v7paxbup7r6hj2ht
       foreign key (shop_id)
       references shops (id);

    alter table product_form_custom_fields
       add constraint FK_PRODUCT_FIELD_CONFIG
       foreign key (config_id)
       references product_form_configs (id);

    alter table product_form_field_options
       add constraint FK_PRODUCT_OPTION_FIELD
       foreign key (field_id)
       references product_form_custom_fields (id);

    alter table product_images
       add constraint FKqnq71xsohugpqwf3c9gxmsuy
       foreign key (product_id)
       references products (id);

    alter table product_qr_codes
       add constraint FKhri1obvxpbvjr3o9a9ncqv9r6
       foreign key (created_by)
       references users (id);

    alter table product_qr_codes
       add constraint FK89ow0lr0hjodgvagqvimupylp
       foreign key (product_id)
       references products (id);

    alter table product_variants
       add constraint FKosqitn4s405cynmhb87lkvuau
       foreign key (product_id)
       references products (id);

    alter table products
       add constraint FKsn53tjft815p9ssd128bg6orf
       foreign key (category_id)
       references shop_categories (id);

    alter table products
       add constraint FK7kp8sbhxboponhx3lxqtmkcoj
       foreign key (shop_id)
       references shops (id);

    alter table refresh_tokens
       add constraint FK1lih5y2npsf8u5o3vhdb9y0os
       foreign key (user_id)
       references users (id);

    alter table rental_availability
       add constraint FKp49sjbo3cltjco86ioyets77n
       foreign key (order_id)
       references orders (id);

    alter table rental_availability
       add constraint FKnes6mi8yhyp8494wr8c9evxmy
       foreign key (variant_id)
       references product_variants (id);

    alter table shop_addresses
       add constraint FKdqm2dvywp1h3d1q0hjlp86224
       foreign key (shop_id)
       references shops (id);

    alter table shop_categories
       add constraint FKidgwn2wkyt6ebkm9a1u1n7usl
       foreign key (shop_id)
       references shops (id);

    alter table shop_onboarding_states
       add constraint FKftgqa6g201rdfuixjr1yhvpsl
       foreign key (shop_id)
       references shops (id);

    alter table shop_order_sources
       add constraint FK1ja5ochpse4q2m6gsrmnsix17
       foreign key (shop_id)
       references shops (id);

    alter table shop_payment_configs
       add constraint FKf1drr53ecdr7f90j6n56u0ryh
       foreign key (shop_id)
       references shops (id);

    alter table shop_shipping_methods
       add constraint FKcmkj3f2om5l6dgbx046t0d8uh
       foreign key (shop_id)
       references shops (id);

    alter table staff_permissions
       add constraint FK4im7nxkd6an5rxb97ehbmpn3k
       foreign key (granted_by)
       references users (id);

    alter table staff_permissions
       add constraint FKtdfu46kmn2ex9bhvqbf61nnns
       foreign key (permission_id)
       references permissions (id);

    alter table staff_permissions
       add constraint FKfevyxwf2lhjrqx3d1aaxnh78w
       foreign key (user_id)
       references users (id);

    alter table users
       add constraint FKbadc51v95q4hmcfflt8g3yfck
       foreign key (shop_id)
       references shops (id);

    alter table work_shift_staff
       add constraint FK5oj29umkg5ulnblkfky4x9d3b
       foreign key (staff_id)
       references users (id);

    alter table work_shift_staff
       add constraint FKidmhyi56buu1xlmslxwcn2o2d
       foreign key (shift_id)
       references work_shifts (id);

    alter table work_shifts
       add constraint FKchhktnu1xeabpskg8yov326bi
       foreign key (shop_id)
       references shops (id);
