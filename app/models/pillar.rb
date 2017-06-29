# frozen_string_literal: true
# Pillar represents a pillar value on Salt.
#
# This can override already existing pillar values, or create completely new ones.
#
# For example, given that we have on our static pillar:
#
#   certificate_information:
#     subject_properties:
#       C: DE
#       O: SUSE
#
# We could override them by creating the following Pillar records:
#
#   Pillar.create pillar: "certificate_information:subject_properties:C", value: "FR"
#   Pillar.create pillar: "certificate_information:subject_properties:O", value: "My Company"
#
# Lists can be represented as collisions. So, creating the following Pillar records:
#
#   Pillar.create pillar: "my_service:extra_ips", value: "127.0.0.1"
#   Pillar.create pillar: "my_service:extra_ips", value: "127.0.0.2"
#
# Would match the following YAML representation:
#
#   my_service:
#     extra_ips:
#       - 127.0.0.1
#       - 127.0.0.2
#
# This is because how we configure our salt master using this table as an external pillar. For
# further information you can visit:
#   - https://github.com/kubic-project/velum/blob/master/docs/salt.md
#   - https://github.com/kubic-project/salt/blob/master/config/master.d/returner.conf
class Pillar < ApplicationRecord
  validates :pillar, presence: true
  validates :value, presence: true

  scope :global, -> { where minion_id: nil }

  OPTIONAL_PILLARS = [:http_proxy, :https_proxy, :no_proxy].freeze

  class << self
    def value(pillar:)
      Pillar.find_by(pillar: all_pillars[pillar]).try(:value)
    end

    def all_pillars
      {
        dashboard:   "dashboard",
        apiserver:   "api:server:external_fqdn",
        proxy_systemwide: "proxy:systemwide",
        http_proxy:  "proxy:http",
        https_proxy: "proxy:https",
        no_proxy:    "proxy:no_proxy"
      }
    end

    # Apply the given pillars into the database. It returns an array with the
    # encountered errors.
    def apply(pillars)
      errors = []

      Pillar.all_pillars.each do |key, pillar_key|
        # The following pillar keys can be blank, delete them if they are.
        if [:http_proxy, :https_proxy, :no_proxy].include?(key) && pillars[key].blank?
          pillar = Pillar.find_by pillar: pillar_key
          pillar.destroy if pillar
        else
          pillar = Pillar.find_or_initialize_by pillar: pillar_key
          pillar.value = pillars[key]
          next if pillar.save

          exp = pillar.errors.empty? ? "" : ": #{pillar.errors.messages[:value].first}"
          errors << "'#{key}' could not be saved#{exp}."
        end
      end

      errors
    end
  end
end
