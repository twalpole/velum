# frozen_string_literal: true

# rubocop:disable Metrics/BlockLength
Rails.application.routes.draw do
  get "/autoyast", to: "dashboard#autoyast"
  next if ENV["VELUM_PORT"].to_i != 443
  devise_for :users, controllers: { registrations: "auth/registrations",
                                    sessions:      "auth/sessions" }

  resource :dashboard, only: [:index]
  resource :updates, only: [:create]

  get "/assign_nodes", to: "dashboard#unassigned_nodes"
  post "/assign_nodes", to: "dashboard#assign_nodes"

  authenticated :user do
    root "dashboard#index", as: :authenticated_root
  end

  devise_scope :user do
    root to: "auth/sessions#new"
  end

  get "/autoyast", to: "dashboard#autoyast"
  get "/kubectl-config", to: "dashboard#kubectl_config"
  get "/_health", to: "health#index"
  post "/update", to: "salt#update"
  post "/accept-minion", to: "salt#accept_minion"

  namespace :setup do
    get "/", action: :welcome
    match "/", action: :configure, via: [:put, :patch]
    get :"worker-bootstrap"
    get :discovery
    post :bootstrap
  end
end
# rubocop:enable Metrics/BlockLength
